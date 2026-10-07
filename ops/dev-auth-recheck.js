// Executed only in Dev. The caller supplies `qa` from the existing private QA file.
// Never print passwords, reset links, custom tokens, or ID tokens.
const assert=require('assert'),crypto=require('crypto'),fs=require('fs');
assert.equal(process.env.FIREBASE_PROJECT_ID,'kirokun-dev');
assert.equal(process.env.ACCOUNT_SCOPE,'dev');
assert.equal(process.env.NOTIFICATIONS_ENABLED,'false');
assert.equal(process.env.ASSIGNMENT_PREPARATION_ENABLED,'false');
assert(/^qa_auth_[0-9]+$/.test(qa.username));
const admin=require('./dist/services/firebaseAdmin.service').default;
assert(!fs.existsSync('/tmp/dev-auth-recheck-20261006.json'), 'Preserve and clear previous QA output before rerunning; no password was changed');
async function api(path,body,token){
 const r=await fetch('http://127.0.0.1:9001/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={}}return {status:r.status,data,retry:r.headers.get('retry-after')};
}
async function exchange(token){
 const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='+process.env.QA_FIREBASE_WEB_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true}),signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200);const data=await r.json();assert(data.idToken);return data.idToken;
}
(async()=>{
 const login=await api('auth/username-login',{username:qa.username,password:qa.password});assert.equal(login.status,200);
 const oldToken=await exchange(login.data.customToken);
 assert.equal((await api('me',null,oldToken)).data.userId,qa.userId);
 assert.equal((await api('users/'+qa.userId+'/assignments',null,oldToken)).status,200);
 const attempts=await Promise.all(Array.from({length:4},()=>api('auth/username-login',{username:qa.username,password:qa.password})));
 assert(attempts.some(r=>r.status===200));assert(attempts.some(r=>r.status===503&&r.retry==='2'));
 assert(attempts.every(r=>[200,503].includes(r.status)));
 const owner=Object.entries(JSON.parse(process.env.AUTH_IDENTITY_MAP)).find(([,v])=>v.isAdmin);
 const ownerToken=await exchange(await admin.auth().createCustomToken(owner[0]));
 const reset=await api('admin/password-resets',{username:qa.username},ownerToken);assert.equal(reset.status,200);
 const password=crypto.randomBytes(24).toString('base64');
 const changed=await api('auth/reset-password',{reset:reset.data.reset,password});assert.equal(changed.status,200);
 // Preserve the new QA credential immediately, even if a subsequent assertion fails.
 fs.writeFileSync('/tmp/dev-auth-recheck-20261006.json',JSON.stringify({...qa,password})+'\n',{mode:0o600,flag:'wx'});
 assert.equal((await api('auth/username-login',{username:qa.username,password:qa.password})).status,401);
 const fresh=await api('auth/username-login',{username:qa.username,password});assert.equal(fresh.status,200);
 const token=await exchange(fresh.data.customToken);
 assert.equal((await api('me',null,token)).data.userId,qa.userId);
 assert.equal((await api('me',null,oldToken)).status,401);
 assert.equal((await api('auth/reset-password',{reset:reset.data.reset,password})).status,400);
 assert.equal((await api('admin/account-invitations',{username:'should_not_be_created'},token)).status,401);
 console.log(JSON.stringify({result:'passed',concurrentAccepted:attempts.filter(r=>r.status===200).length,concurrentBusy:attempts.filter(r=>r.status===503).length,reset:true,oldSessionDenied:true,identityPreserved:true}));
})().then(()=>process.exit(0)).catch(e=>{console.error('FAIL:',e.message);process.exit(1)});
