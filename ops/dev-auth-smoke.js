// Run only inside the isolated kirokun-dev API container; never print credentials.
const assert=require('assert'); const crypto=require('crypto'); const fs=require('fs');
assert.equal(process.env.FIREBASE_PROJECT_ID,'kirokun-dev');
assert.equal(process.env.ACCOUNT_SCOPE,'dev');
assert.equal(process.env.NOTIFICATIONS_ENABLED,'false');
assert.equal(process.env.ASSIGNMENT_PREPARATION_ENABLED,'false');
const admin=require('./dist/services/firebaseAdmin.service').default;
const mongoose=require('mongoose');
const {Account}=require('./dist/accounts/models');
const key=process.env.QA_FIREBASE_WEB_API_KEY;
assert(key);
const name='qa_auth_'+Date.now();
const initial=crypto.randomBytes(24).toString('base64');
const password=crypto.randomBytes(24).toString('base64');
async function api(path,body,token){
 const r=await fetch('http://127.0.0.1:9001/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={}};return {status:r.status,data};
}
async function exchange(token){
 const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true}),signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,200,'Firebase token exchange'); const data=await r.json();assert(data.idToken);return data.idToken;
}
(async()=>{
 await mongoose.connect(process.env.MONGO_URL,{useNewUrlParser:true,useUnifiedTopology:true});
 const snapshots=[];
 for(const collection of ['users','groups','surveys','assignments','datasets','assignmentresults']){
   const rows=await mongoose.connection.db.collection(collection).find({}).sort({_id:1}).toArray();
   snapshots.push({collection,ids:rows.map(r=>r._id),serialized:JSON.stringify(rows)});
 }
 const owner=Object.entries(JSON.parse(process.env.AUTH_IDENTITY_MAP)).find(([,value])=>value.isAdmin===true);
 assert(owner,'Dev administrator mapping required');
 const ownerToken=await exchange(await admin.auth().createCustomToken(owner[0]));
 assert.equal((await api('me',null,ownerToken)).data.userId,owner[1].userId);
 const options=await api('auth/options'); assert.equal(options.data.invitations,true);
 const invite=await api('admin/account-invitations',{username:name},ownerToken);assert.equal(invite.status,201,'invite');
 const active=await api('auth/activate',{invitation:invite.data.invitation,password:initial});assert.equal(active.status,200,'activate');
 const record=await Account.findOne({scope:'dev',username:name}).lean();assert(record);
 const token=await exchange(active.data.customToken);
 assert.equal((await api('me',null,token)).data.userId,record.userId,'stable identity');
 assert.equal((await api('users/'+record.userId+'/assignments',null,token)).status,200,'own assignments');
 assert.equal((await api('admin/account-invitations',{username:name+'_denied'},token)).status,401,'participant denied admin');
 const reset=await api('admin/password-resets',{username:name},ownerToken);assert.equal(reset.status,200,'reset issue');
 const applied=await api('auth/reset-password',{reset:reset.data.reset,password});assert.equal(applied.status,200,'reset');
 assert.equal((await api('auth/username-login',{username:name,password:initial})).status,401,'old password denied');
 const login=await api('auth/username-login',{username:name,password});assert.equal(login.status,200,'new password login');
 const fresh=await exchange(login.data.customToken);
 assert.equal((await api('me',null,fresh)).data.userId,record.userId,'identity preserved after reset');
 assert.equal((await api('me',null,token)).status,401,'old custom session denied');
 assert.equal((await api('auth/reset-password',{reset:reset.data.reset,password})).status,400,'single use');
 for(const snap of snapshots){
   const rows=await mongoose.connection.db.collection(snap.collection).find({_id:{$in:snap.ids}}).sort({_id:1}).toArray();
   assert.equal(JSON.stringify(rows),snap.serialized,'pre-existing data unchanged: '+snap.collection);
 }
 fs.writeFileSync('/tmp/kirokun-dev-auth-test-account.json',JSON.stringify({username:name,password,userId:record.userId,uid:record.uid})+'\n',{mode:0o600,flag:'wx'});
 console.log('PASS: live Dev Firebase invitation, activation, identity, own surveys, admin denial, reset, old password/session rejection, and unchanged pre-existing documents. One QA participant retained; credentials saved privately.');
})().catch(e=>{console.error('FAIL:',e.message);process.exitCode=1}).finally(()=>mongoose.disconnect());
