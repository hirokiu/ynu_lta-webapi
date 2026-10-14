const assert = require('assert');
const express = require('express');
const http = require('http');
const fs = require('fs');
const os = require('os');
const {exportFile} = require('../dist/utils/exportFile');
const pause = ms => new Promise(r=>setTimeout(r,ms));
async function main() {
 const before=new Set(fs.readdirSync(os.tmpdir()).filter(s=>s.startsWith('kirokun-export-')));
 let closed=0, pulled=0;
 const app=express();
 app.get('/:mode',async(req,res)=>{
  let n=0;
  const mode=req.params.mode;
  await exportFile(res,async()=>({
   next:async()=>{
    if(mode==='slow') await pause(50);
    if(mode==='fail') throw Error('Synthetic database failure');
    if(n++ >= (mode==='large'?24000:mode==='slow'?100:1)) return null;
    pulled++;
    return {id:n, text:mode==='large'?'x'.repeat(4096):'a,"b"\n日本語'};
   },close:async()=>{closed++;}
  }), 'csv', rows=>rows);
 });
 const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
 const get=(mode)=>new Promise((resolve,reject)=>{
  http.get({host:'127.0.0.1',port:server.address().port,path:'/'+mode},res=>{
   let bytes=0;res.on('data',c=>bytes+=c.length);
   res.on('end',()=>resolve({status:res.statusCode,bytes}));
  }).on('error',reject);
 });
 try {
  const start=process.memoryUsage().rss; let peak=start;
  const sampler=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().rss)},5);
  const large=await get('large'); clearInterval(sampler);
  assert.equal(large.status,200); assert(large.bytes>93*1024*1024);assert.equal(pulled,24000);
  assert(peak < 192*1024*1024, 'Peak RSS MiB: '+peak/1048576);
  await pause(30);
  const slow=http.get({host:'127.0.0.1',port:server.address().port,path:'/slow'});
  slow.on('error',()=>{});
  await pause(100);
  assert.equal((await get('simple')).status,429);
  slow.destroy(); await pause(150);
  assert.equal((await get('fail')).status,500); await pause(30);
  assert.equal((await get('simple')).status,200); await pause(30);
  assert.equal(closed,4);
  const leftovers=fs.readdirSync(os.tmpdir()).filter(s=>s.startsWith('kirokun-export-')&&!before.has(s));
  assert.deepEqual(leftovers,[]);
  console.log(JSON.stringify({tests:'passed',rows:24000,bytes:large.bytes,peakRssMiB:peak/1048576,rssGrowthMiB:(peak-start)/1048576}));
 } finally {await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exit(1)});
