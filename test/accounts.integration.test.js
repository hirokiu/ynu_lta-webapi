// Local disposable MongoDB only; Firebase calls are replaced with an in-process fake.
const assert = require('assert');
const mongoose = require('mongoose');
const express = require('express');
const crypto = require('crypto');
process.env.AUTH_MODE = 'uid';
process.env.AUTH_IDENTITY_MAP = JSON.stringify({owner:{userId:'hiroki_u',isAdmin:true},researcher:{userId:'hanzawa',isAdmin:true},legacy:{userId:'old_participant',isAdmin:false}});
process.env.USERNAME_ACCOUNTS_ENABLED = 'true';
process.env.ACCOUNT_SCOPE = 'test-lab';
const users = new Map([['researcher',{uid:'researcher',email:'hanzawa@humlablu.com',disabled:false}]]);
const fake = {auth:()=>({
  verifyIdToken:async token=>{if(token && token.startsWith('issued:'))return {uid:token.slice(7)};if(token==='owner')return {uid:'owner'};if(token==='legacy')return {uid:'legacy'};throw Error('bad token')},
  createUser:async input=>{if(users.has(input.uid))throw Object.assign(Error('exists'),{code:'auth/uid-already-exists'}); users.set(input.uid,{...input,disabled:false,providerData:[]});return input},
  getUserByEmail:async email=>{if(email==='firebase_only@humlablu.com')return {uid:'existing-only'};throw Object.assign(Error('not found'),{code:'auth/user-not-found'})},
  getUser:async uid=>{if(!users.has(uid))throw Error('missing');return users.get(uid)},
  createCustomToken:async uid=>'test-token-'+uid
})};
const firebasePath=require.resolve('../dist/services/firebaseAdmin.service');
require.cache[firebasePath]={id:firebasePath,filename:firebasePath,loaded:true,exports:{__esModule:true,default:fake}};
const {accountRoutes}=require('../dist/accounts/routes');
const {Account,AuthThrottle}=require('../dist/accounts/models');
const {User}=require('../dist/models/survey.model');
const {resolveAccountIdentity}=require('../dist/accounts/identity');
const {secret,digest,passwordMatches,username}=require('../dist/accounts/credentials');
let server;
(async()=>{
 await mongoose.connect('mongodb://127.0.0.1:27071/kirokun_auth_test_'+crypto.randomBytes(6).toString('hex'),{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
 const app=express();app.use(express.json());accountRoutes(app);
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 const url='http://127.0.0.1:'+server.address().port;
 async function post(path,body,token){const r=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{token}:{})},body:JSON.stringify(body)});const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null};}
 await User.create({userId:'hanzawa',timezone:'Europe/Stockholm',deviceToken:'preserved'});
 await User.create({userId:'old_participant',deviceToken:'untouched'});
 const before=JSON.stringify(await User.find().sort('userId').lean());
 assert.equal((await post('/api/admin/account-invitations',{username:'alice'})).status,401);
 assert.equal((await post('/api/admin/account-invitations',{username:'alice'},'legacy')).status,401);
 assert.equal((await post('/api/admin/account-invitations',{username:'hanzawa'},'owner')).status,409);
 assert.equal((await post('/api/admin/account-invitations',{username:'old_participant'},'owner')).status,409);
 assert.equal((await post('/api/admin/account-invitations',{username:'alice@example.com'},'owner')).status,400);
 assert.equal((await post('/api/admin/account-invitations',{username:'firebase_only'},'owner')).status,409);
 const invite=await post('/api/admin/account-invitations',{username:'alice'},'owner');assert.equal(invite.status,201);
 assert.equal((await post('/api/admin/account-invitations',{username:'alice'},'owner')).status,409);
 const pending=await Account.findOne({username:'alice'}).select('+invitationHash').lean();
 assert.notEqual(pending.invitationHash,invite.body.invitation);
 await assert.rejects(resolveAccountIdentity({uid:pending.uid}));
 const password='a test password with spaces';
 assert.equal((await post('/api/auth/activate',{invitation:invite.body.invitation,password:'short'})).status,400);
 const activated=await Promise.all([1,2].map(()=>post('/api/auth/activate',{invitation:invite.body.invitation,password})));
 assert.equal(activated.filter(r=>r.status===200).length,1);
 assert.equal((await post('/api/auth/activate',{invitation:invite.body.invitation,password})).status,400);
 const active=await Account.findOne({username:'alice'}).select('+passwordHash +invitationHash').lean();
 assert.equal(active.state,'active');assert.equal(active.invitationHash,undefined);assert.notEqual(active.passwordHash,password);
 assert(await passwordMatches(password,active.passwordHash));
 assert.deepEqual(await resolveAccountIdentity({uid:active.uid}),{userId:active.userId,isAdmin:false});
 assert.equal((await post('/api/auth/username-login',{username:'alice',password})).status,200);
 assert.equal((await post('/api/auth/username-login',{username:'alice',password:'wrong but long password'})).status,401);
 assert.equal((await post('/api/auth/username-login',{username:'missing',password})).status,401);
 users.get(active.uid).disabled=true;
 assert.equal((await post('/api/auth/username-login',{username:'alice',password})).status,401);
 const expired=await post('/api/admin/account-invitations',{username:'expired'},'owner');
 await Account.updateOne({username:'expired'},{$set:{invitationExpiresAt:new Date(0)}});
 assert.equal((await post('/api/auth/activate',{invitation:expired.body.invitation,password})).status,400);
 const googleInvite=await post('/api/admin/account-invitations',{username:'google_user'},'owner');
 const googleBody={invitation:googleInvite.body.invitation};
 const googleSession=await post('/api/auth/invitation-google-session',googleBody);assert.equal(googleSession.status,200);
 const googleAccount=await Account.findOne({username:'google_user'}).lean();
 await assert.rejects(resolveAccountIdentity({uid:googleAccount.uid}));
 assert.equal((await post('/api/auth/activate-google',googleBody,'issued:'+active.uid)).status,400);
 assert.equal((await post('/api/auth/activate-google',googleBody,'issued:'+googleAccount.uid)).status,400);
 users.get(googleAccount.uid).providerData=[{providerId:'google.com',email:'test@example.invalid'}];
 assert.equal((await post('/api/auth/activate-google',googleBody,'issued:'+googleAccount.uid)).status,200);
 assert.equal((await post('/api/auth/activate-google',googleBody,'issued:'+googleAccount.uid)).status,400);
 assert.deepEqual(await resolveAccountIdentity({uid:googleAccount.uid}),{userId:googleAccount.userId,isAdmin:false});
 assert.equal((await post('/api/auth/username-login',{username:'google_user',password})).status,401);
 const migrationToken=secret();
 await Account.create({scope:'test-lab',username:'hanzawa',uid:'researcher',userId:'hanzawa',migration:true,state:'invited',invitationHash:digest(migrationToken),invitationExpiresAt:new Date(Date.now()+60000)});
 assert.deepEqual(await resolveAccountIdentity({uid:'researcher'}),{userId:'hanzawa',isAdmin:true});
 assert.equal((await post('/api/auth/invitation-google-session',{invitation:migrationToken})).status,409);
 assert.equal((await post('/api/auth/activate',{invitation:migrationToken,password})).status,200);
 assert.deepEqual(await resolveAccountIdentity({uid:'researcher'}),{userId:'hanzawa',isAdmin:true});
 assert.deepEqual(await resolveAccountIdentity({uid:'legacy'}),{userId:'old_participant',isAdmin:false});
 assert.equal(JSON.stringify(await User.find({userId:{$in:['hanzawa','old_participant']}}).sort('userId').lean()),before);
 for(let i=0;i<11;i++){const r=await post('/api/auth/username-login',{username:'missing',password});if(i===10)assert.equal(r.status,429);}
 process.env.USERNAME_ACCOUNTS_ENABLED='false';
 assert.equal((await post('/api/auth/username-login',{username:'alice',password})).status,404);
 assert.deepEqual(await resolveAccountIdentity({uid:'legacy'}),{userId:'old_participant',isAdmin:false});
 ['Abc','ab','x@y','with space','a'.repeat(33)].forEach(name=>assert.throws(()=>username(name)));
 console.log('PASS: invitation authorization, existing account protection, duplicates, expiry, concurrent single use, password verification, disabled account, throttling, migration identity/privileges, unchanged existing user data, feature-off compatibility. Firebase and credential removal are mocked/not executed.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server)server.close();if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();await mongoose.disconnect()});
