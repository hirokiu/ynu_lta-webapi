const assert=require('assert'),{fork}=require('child_process'),http=require('http');
const children=[];
function start(side){return new Promise((resolve,reject)=>{const c=fork(require.resolve('./worker'),[],{execArgv:['-r','ts-node/register/transpile-only'],env:{...process.env,LAB_SIDE:side,TEST_MONGO_URL:`mongodb://127.0.0.1:${side==='a'?37031:37032}/kirokun_isolation_test`},stdio:['ignore','ignore','inherit','ipc']});children.push(c);const t=setTimeout(()=>reject(Error('startup timeout')),30000);c.once('message',m=>{clearTimeout(t);resolve(m.port)});c.once('exit',code=>{clearTimeout(t);if(code)reject(Error('worker failed '+code));});});}
function request(port,path,token,body,headers={}){return new Promise((resolve,reject)=>{const q=http.request({hostname:'127.0.0.1',port,path,method:body?'PUT':'GET',headers:{token,'Content-Type':'application/json',...headers}},r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{resolve({status:r.statusCode,body:JSON.parse(s)})})});q.on('error',reject);q.end(body?JSON.stringify(body):undefined);});}
(async()=>{try{
 const a=await start('a'),b=await start('b');
 for(const [port,own,other,side] of [[a,'owner-a','owner-b','a'],[b,'owner-b','owner-a','b']]){
  assert.equal((await request(port,'/api/me',own)).body.project.projectId,'lab-'+side);
  assert.equal((await request(port,'/api/admin/surveys',own)).body.items[0].name,'Only project '+side);
  assert.equal((await request(port,'/api/surveys/aaaaaaaaaaaaaaaaaaaaaaaa',own)).body.title,'Synthetic '+side);
  for(const route of ['/api/me','/api/admin/surveys','/api/surveys/aaaaaaaaaaaaaaaaaaaaaaaa'])assert.equal((await request(port,route,other)).status,401);
  assert.equal((await request(port,'/api/admin/project',other,{displayName:'attack',revision:1})).status,401);
  const spoof=await request(port,'/api/project?projectId=lab-'+(side==='a'?'b':'a'),own,undefined,{'X-Project-Id':'another',Host:'another.kirokun.invalid'});
  assert.equal(spoof.body.projectId,'lab-'+side);
 }
 assert.equal((await request(a,'/api/admin/surveys','shared')).status,200);
 assert.equal((await request(b,'/api/admin/surveys','shared')).status,401);
 assert.equal((await request(b,'/api/me','shared')).status,200);
 assert.equal((await request(a,'/api/admin/project','owner-a',{displayName:'Renamed A',subtitle:'Updated A',revision:1})).status,200);
 assert.equal((await request(b,'/api/project','owner-b')).body.displayName,'Project b');
 console.log(JSON.stringify({result:'passed',projects:2,checks:['independent databases','same local username and survey ID','foreign UID denied','project ID/Host spoof does not switch DB','membership-specific role','project settings changes isolated'],firebase:'mocked verification; production middleware and routes used'}));
 }finally{for(const c of children)c.kill('SIGTERM');}
})().catch(e=>{console.error(e);process.exitCode=1});
