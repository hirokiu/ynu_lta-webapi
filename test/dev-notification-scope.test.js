const assert=require('assert');
const firebase=require.resolve('../dist/services/firebaseAdmin.service');
require.cache[firebase]={id:firebase,filename:firebase,loaded:true,exports:{__esModule:true,default:{}}};
const {SurveyService}=require('../dist/services/surveyApi.service');
const {Assignment,AssignmentResults}=require('../dist/models/survey.model');
(async()=>{
 process.env.ACCOUNT_SCOPE='dev';delete process.env.DEV_QA_NOTIFICATION_USERS;
 let queries=0,sends=0;
 for(const model of [Assignment,AssignmentResults]) model.find=filter=>{
  queries++;assert.deepEqual(filter.userId,{$in:['synthetic-ios','synthetic-android']});
  const q={sort(){return q},populate(){return q},lean(){return q},cursor(){return {next:async()=>null,close:async()=>{}}}};return q;
 };
 const service=new SurveyService();
 await service.FindRegistrationTokensForNotification(async()=>{sends++;return true});
 assert.equal(queries,0);assert.equal(sends,0);
 process.env.DEV_QA_NOTIFICATION_USERS='synthetic-ios, synthetic-android';
 await service.FindRegistrationTokensForNotification(async()=>{sends++;return true});
 assert.equal(queries,4);assert.equal(sends,0);
 console.log('PASS: Dev fails closed without QA allowlist; all notification queries are scoped');
})().catch(e=>{console.error(e);process.exitCode=1});
