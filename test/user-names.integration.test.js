const assert = require('assert'), mongoose = require('mongoose'), express = require('express'), crypto = require('crypto');
process.env.AUTH_MODE='uid'; process.env.ACCOUNT_SCOPE='proto'; process.env.USERNAME_ACCOUNTS_ENABLED='true';
process.env.AUTH_IDENTITY_MAP=JSON.stringify({owner:{userId:'hiroki_u',isAdmin:true},participant:{userId:'participant',isAdmin:false}});
const firebasePath=require.resolve('../dist/services/firebaseAdmin.service');
require.cache[firebasePath]={id:firebasePath,filename:firebasePath,loaded:true,exports:{__esModule:true,default:{auth:()=>({verifyIdToken:async token=>{if(!['owner','participant'].includes(token))throw Error('unauthorized');return {uid:token};}})}}};
const {Controller}=require('../dist/main.controller'),{Account}=require('../dist/accounts/models'),{User}=require('../dist/models/survey.model');
(async()=>{
 await mongoose.connect('mongodb://127.0.0.1:27071/kirokun_users_'+crypto.randomBytes(8).toString('hex'),{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
 const app=express();app.use(express.json());new Controller(app);
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});
 async function get(path,token='owner'){const r=await fetch('http://127.0.0.1:'+server.address().port+path,{headers:{token}});return {status:r.status,body:await r.json()};}
 try{
  const id='u_'+'1'.repeat(32),orphan='u_'+'2'.repeat(32);
  await User.create([{userId:id},{userId:'legacy_name'},{userId:orphan}]);
  await Account.create({scope:'proto',username:'alice_test',uid:id,userId:id,state:'active',passwordHash:'secret',invitationHash:'private',createdBy:'owner'});
  const all=await get('/api/users');assert.equal(all.status,200);assert.equal(all.body.find(u=>u.userId===id).username,'alice_test');assert.equal(all.body.find(u=>u.userId==='legacy_name').username,'legacy_name');assert.equal(all.body.find(u=>u.userId===orphan).username,null);
  assert(!JSON.stringify(all.body).includes('secret'));assert(!JSON.stringify(all.body).includes('invitationHash'));
  const found=await get('/api/users/search?t=ALICE');assert.equal(found.body.length,1);assert.equal(found.body[0].userId,id);
  assert.equal((await get('/api/users/search?t=%2E*')).body.length,0);
  const detail=await get('/api/users/'+id);assert.equal(detail.body.username,'alice_test');assert.equal(detail.body.userId,id);
  assert.equal((await get('/api/users','participant')).status,401);
  process.env.ACCOUNT_SCOPE='dev';assert.equal((await get('/api/users')).body.find(u=>u.userId===id).username,null);
  assert.equal((await User.findOne({userId:id}).lean()).userId,id);assert.equal((await Account.findOne({userId:id}).lean()).username,'alice_test');
  console.log('PASS: username list/search/detail, stable IDs, legacy fallback, scope isolation, no credential fields, admin-only access.');
 }finally{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
