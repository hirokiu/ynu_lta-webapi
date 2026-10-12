// Synthetic identities and an isolated local database; no deployed data or Firebase access.
const assert = require('assert'), mongoose = require('mongoose'), express = require('express'), crypto = require('crypto');
process.env.AUTH_MODE='uid'; process.env.ACCOUNT_SCOPE='proto';
process.env.AUTH_IDENTITY_MAP=JSON.stringify({owner:{userId:'hiroki_u',isAdmin:true},participant:{userId:'participant',isAdmin:false}});
const firebasePath=require.resolve('../dist/services/firebaseAdmin.service');
require.cache[firebasePath]={id:firebasePath,filename:firebasePath,loaded:true,exports:{__esModule:true,default:{auth:()=>({verifyIdToken:async token=>{if(!['owner','participant'].includes(token))throw Error('unauthorized');return {uid:token};}})}}};
const {Controller}=require('../dist/main.controller');
const {ProjectSettings}=require('../dist/projects/settings');
(async()=>{
 await mongoose.connect('mongodb://127.0.0.1:27071/kirokun_project_'+crypto.randomBytes(8).toString('hex'),{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
 const app=express();app.use(express.json());new Controller(app);
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});
 async function call(path,token,body) { const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method:body?'PUT':'GET',headers:{'Content-Type':'application/json',...(token?{token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')}; }
 try {
  assert.equal((await call('/api/project')).status,401);
  const initial=await call('/api/project','participant'); assert.equal(initial.cache,'no-store');assert.deepEqual(initial.body,{projectId:'proto',displayName:'Proto',revision:0,timezone:'Asia/Tokyo'});
  assert.equal((await call('/api/admin/project','participant',{displayName:'bad',revision:0})).status,401);
  for(const name of ['', '   ', 'a\nb', 'a'.repeat(81), 42, 'a\u202eb']) assert.equal((await call('/api/admin/project','owner',{displayName:name,revision:0})).status,400);
  assert.equal((await call('/api/admin/project','owner',{displayName:'名前',revision:0,apiBaseUrl:'https://untrusted.invalid'})).status,400);
  const races=await Promise.all(['言語研究','別の更新'].map(displayName=>call('/api/admin/project','owner',{displayName,revision:0})));
  assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
  let row=await call('/api/project','participant');assert.equal(row.body.revision,1);
  assert.equal((await call('/api/admin/project','owner',{displayName:'stale',revision:0})).status,409);
  const updated=await call('/api/admin/project','owner',{displayName:' 新しい調査名 ',revision:1});assert.equal(updated.status,200);assert.equal(updated.body.displayName,'新しい調査名');
  const me=await call('/api/me','participant');assert.equal(me.body.userId,'participant');assert.equal(me.body.project.displayName,'新しい調査名');
  const stored=await ProjectSettings.findById('proto').lean();assert.equal(stored.history.length,2);assert.equal(stored.history[1].actor,'hiroki_u');
  assert.equal((await call('/api/admin/project','owner',{displayName:'名前',revision:2,timezone:'bad/zone'})).status,400);
  const zoned=await call('/api/admin/project','owner',{displayName:'名前',revision:2,timezone:'America/New_York'});assert.equal(zoned.body.timezone,'America/New_York');
  assert.equal((await call('/api/admin/project','owner',{displayName:'互換',revision:3})).body.timezone,'America/New_York');
  const {SurveyService}=require('../dist/services/surveyApi.service');
  const service=new SurveyService(), dates=[];
  service.saveNewGroupAssignment=(sid,gid,from,to,callback)=>{dates.push(from.toISOString());callback(201,{});};
  await new Promise((resolve,reject)=>service.createGroupAssignmentSeries({header:()=> 'owner',headers:{token:'owner'},params:{},body:{}},'survey','group','2026-03-07','2026-03-09',['09:00'],0,{status(code){assert.equal(code,201);return this;},send(){resolve();}}));
  assert.deepEqual(dates,['2026-03-07T14:00:00.000Z','2026-03-08T13:00:00.000Z','2026-03-09T13:00:00.000Z']);
  process.env.ACCOUNT_SCOPE='dev';assert.equal((await call('/api/project','owner')).body.displayName,'Dev');
  console.log('PASS: authenticated metadata, admin-only edit, validation, concurrent first creation, stale update, audit, /me compatibility and environment isolation.');
 }finally{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
