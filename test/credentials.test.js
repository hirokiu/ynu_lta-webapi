const assert=require('assert');
const {passwordHash,passwordMatches,PasswordWorkBusy}=require('../dist/accounts/credentials');
(async()=>{
 const password='not-a-real-password-for-unit-test';
 const jobs=await Promise.allSettled(Array.from({length:8},()=>passwordHash(password)));
 assert.equal(jobs.filter(x=>x.status==='fulfilled').length,1);
 for(const x of jobs.filter(x=>x.status==='rejected')) assert(x.reason instanceof PasswordWorkBusy);
 const hash=jobs.find(x=>x.status==='fulfilled').value;
 assert(await passwordMatches(password,hash));
 assert.equal(await passwordMatches(password+'wrong',hash),false);
 assert.equal(await passwordMatches(password,''),false);
 await assert.rejects(()=>passwordHash('short'));
 assert(await passwordMatches(password,hash));
 console.log('PASS: one concurrent password job, explicit busy rejection, recovery and credential compatibility');
})().catch(e=>{console.error(e);process.exit(1)});
