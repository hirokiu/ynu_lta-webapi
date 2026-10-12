// Run against an isolated disposable database only. Never point this at production.
process.env.ACCOUNT_SCOPE='proto';
const assert = require('assert');
const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const fs = require('fs');
const ts = require('typescript');
const Module = require('module');
const firebasePath = require.resolve('../src/services/firebaseAdmin.service');
require.cache[firebasePath] = {id:firebasePath,filename:firebasePath,loaded:true,exports:{__esModule:true,default:{auth:()=>({verifyIdToken:async token=>{if(token!=='test-only') throw Error('unauthorized');return {email:'hiroki_u@humlablu.com'};}})}}};
const {SurveyService} = require('../src/services/surveyApi.service');
const {Controller} = require('../src/main.controller');
const {Survey,Assignment,AssignmentResults,Group} = require('../src/models/survey.model');
async function main() {
 const uri = process.env.TEST_MONGO_URL || 'mongodb://127.0.0.1:37017/kirokun_refactor_test';
 assert(/^mongodb:\/\/127\.0\.0\.1:37017\/kirokun_refactor_test$/.test(uri),'Only the isolated local test database is allowed');
 await mongoose.connect(uri,{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
 await mongoose.connection.dropDatabase();
 const survey = await Survey.create({name:'Literal [survey]+',title:'Synthetic',questions:[{index:1,type:'multi'}]});
 const assignments = await Assignment.insertMany(Array.from({length:120},(_,i)=>({userId:i<110?'hiroki_u':'other',publishAt:new Date('2026-01-01T00:00:00Z'),survey:survey.toObject()})));
 const results = [
  {assignment:assignments[0]._id,userId:'hiroki_u',lastOpenedAt:new Date('2026-01-02T00:00:00Z'),dataset:{answers:[{index:1,type:'multi',multiValue:[1,2]},{index:2,type:'duration',intValue:90}]}},
  {assignment:assignments[0]._id,userId:'other',lastOpenedAt:new Date('2026-01-03T00:00:00Z'),dataset:{answers:[{index:1,type:'multi',multiValue:[2]}]}}
 ];
 const savedResults = await AssignmentResults.insertMany(results);
 const app=express();app.use(express.json());new Controller(app);const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const requestOnce=(path,token='test-only',data)=>new Promise((resolve,reject)=>{
  const body=data===undefined?undefined:JSON.stringify(data);
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method:body?'POST':'GET',headers:{token,'Content-Type':'application/json'}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text,json:()=>JSON.parse(text)}));});
  req.on('error',reject);req.end(body);
 });
 const request=async (...args)=>{
  for(let attempt=0;attempt<20;attempt++) {
   const result=await requestOnce(...args);
   if(result.status!==429) return result;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('Export slot was not released');
 };
 try {
  assert.equal((await request('/api/admin/assignments','bad')).status,401);
  await Group.insertMany([{groupId:'Literal [team]+',userIds:[]},{groupId:'Other',userIds:[]}]);
  assert.equal((await request('/api/groups')).json().length,2);
  assert.equal((await request('/api/groups?t='+encodeURIComponent('[team]+'))).json().length,1);
  assert.equal((await request('/api/groups?t=not-present')).json().length,0);
  assert.equal((await request('/api/groups?t=Other','bad')).status,401);
  let first=(await request('/api/admin/assignments?limit=50')).json();
  let second=(await request('/api/admin/assignments?limit=50&page=2')).json();
  assert.equal(first.total,120);assert.equal(second.total,120);assert.equal(first.items.length,50);assert(first.hasMore);assert.equal(new Set([...first.items,...second.items].map(a=>a._id)).size,100);
  assert.equal((await request('/api/admin/assignments?limit=1000')).status,400);
  assert.equal((await request('/api/admin/assignments?t='+encodeURIComponent('[survey]+'))).json().items.length,50);
  assert.equal((await request('/api/admin/assignments?from=2026-02-01&to=2026-02-02')).json().items.length,0);
  assert.equal((await request('/api/admin/surveys')).json().items.length,1);
  assert.equal((await request('/api/admin/surveys')).json().total,1);
  assert.equal((await request('/api/admin/assignments?t=not-present')).json().total,0);
  const last=(await request('/api/admin/assignments?limit=50&page=3')).json();assert.equal(last.total,120);assert.equal(last.items.length,20);assert.equal(last.hasMore,false);
  assert.equal((await request('/api/admin/assignments?from=2026-02-01&to=2026-02-02')).json().total,0);
  const csv=await request(`/api/surveys/${survey._id}/datasets/results/csv?from=2026-01-02T00:00:00Z&to=2026-01-02T23:59:59Z`);
  assert.equal(csv.status,200,csv.text);assert(csv.text.includes('回答者ID'));assert(csv.text.includes('2026-01-02 09:00:00'));assert(csv.text.includes('1.50 (90s)'));assert(!csv.text.includes('other'));
  assert.equal((await request(`/api/surveys/${survey._id}/datasets/results/csv?from=bad`)).status,400);
  const allCsv=await request(`/api/surveys/${survey._id}/datasets/results/csv`);
  const expectedCsv='回答者ID,回答時刻,回答設問数,q01,q01.1,q01.2,q02\nhiroki_u,2026-01-02 09:00:00 +09:00,2,"1,2",1,1,1.50 (90s)\nother,2026-01-03 09:00:00 +09:00,1,2,,1,';
  assert.equal(allCsv.status,200);
  assert.equal(allCsv.text,expectedCsv,'Sparse multiple-choice cells must be empty, never undefined');


  const {ProjectSettings}=require('../src/projects/settings');
  await ProjectSettings.create({_id:'proto',displayName:'Proto',timezone:'America/New_York',revision:1});
  const zonedCsv=await request(`/api/surveys/${survey._id}/datasets/results/csv`);
  assert(zonedCsv.text.includes('2026-01-01 19:00:00 -05:00'));
  const zonedJson=await request(`/api/surveys/${survey._id}/datasets/results/json`);
  assert.equal(zonedJson.status,200);assert.equal(zonedJson.json()[0]['回答時刻'],'2026-01-01 19:00:00 -05:00');
  const summer=SurveyService.getDatasetsOfAssignments([{...results[0],lastOpenedAt:'2026-07-01T00:00:00Z'}],'America/New_York');
  assert.equal(summer[0]['回答時刻'],'2026-06-30 20:00:00 -04:00');
  await ProjectSettings.updateOne({_id:'proto'},{$set:{timezone:'Asia/Tokyo'}});
  const mine=(await request('/api/users/hiroki_u/allassignments')).json();assert.equal(mine.length,110);assert.equal(mine.find(a=>a._id===String(assignments[0]._id)).dataset.answers.length,2);
  for(const size of [10,20,50,100]) assert.equal((await request('/api/admin/assignments?limit='+size)).json().items.length,size);
  const resultPage=(await request(`/api/surveys/${survey._id}/results?limit=1`)).json();
  assert.equal(resultPage.items.length,1);assert(resultPage.hasMore);assert(!resultPage.items[0].dataset);
  assert.equal((await request(`/api/surveys/${survey._id}/results?limit=1`,'bad')).status,401);
  const exportPath=`/api/surveys/${survey._id}/datasets/results/export`;
  const one=await request(exportPath,'test-only',{scope:'selected',format:'json',ids:[String(savedResults[0]._id)]});
  assert.equal(one.status,200);assert.equal(one.json().length,1);assert.equal(one.json()[0]['回答者ID'],'hiroki_u');
  assert.equal((await request(exportPath,'test-only',{scope:'selected',format:'json',ids:[]})).status,400);
  assert.equal((await request(exportPath,'test-only',{scope:'all',format:'json',ids:[String(savedResults[0]._id)]})).status,400);
  assert.equal((await request(exportPath,'test-only',{scope:'period',format:'json'})).status,400);
  assert.equal((await request(exportPath,'test-only',{scope:'all',format:'json'})).json().length,2);
  assert.equal((await request(exportPath,'test-only',{scope:'period',format:'json',from:'2026-01-02T09:00:00.000+09:00',to:'2026-01-02T23:59:59.999+09:00'})).json().length,1);
  const foreignSurvey=await Survey.create({name:'Other survey'});
  const foreignAssignment=await Assignment.create({survey:foreignSurvey.toObject()});
  const foreignResult=await AssignmentResults.create({assignment:foreignAssignment._id,userId:'foreign',dataset:{answers:[{index:1,type:'single',intValue:1}]}});
  assert.equal((await request(exportPath,'test-only',{scope:'selected',format:'json',ids:[String(foreignResult._id)]})).status,422);
  assert.equal((await request(exportPath,'test-only',{scope:'all',format:'json'})).json().length,2);
  await Assignment.updateOne({_id:assignments[1]._id},{$set:{dataset:{answers:[{index:1,type:'single',intValue:5},{index:2,type:'free',stringValue:'研究,"引用"\n次の行'}]},lastOpenedAt:new Date('2026-01-04T00:00:00Z')}});
  // Same assignment + user in both formats is represented once, by the newer format.
  await Assignment.updateOne({_id:assignments[0]._id},{$set:{dataset:{answers:[{index:1,type:'single',intValue:99}]},lastOpenedAt:new Date('2026-01-04T00:00:00Z')}});
  const combined=await request(exportPath,'test-only',{scope:'all',format:'json'});
  assert.equal(combined.status,200,combined.text);assert.equal(combined.json().length,3);assert(!combined.text.includes('99'));
  const mixed=await request(exportPath,'test-only',{scope:'selected',format:'json',ids:[String(savedResults[0]._id),'legacy:'+assignments[1]._id]});
  assert.equal(mixed.status,200,mixed.text);assert.equal(mixed.json().length,2);
  const historyPage=(await request(`/api/surveys/${survey._id}/results?limit=1&page=3`)).json();
  assert.equal(historyPage.total,3);assert.equal(historyPage.hasMore,false);
  const newestPage=(await request(`/api/surveys/${survey._id}/results?limit=1&page=1`)).json();
  assert.equal(newestPage.items[0]._id,'legacy:'+assignments[1]._id,'Recent legacy answers must appear before older modern answers');
  const historyPeriod=await request(exportPath,'test-only',{scope:'period',format:'csv',from:'2026-01-04T00:00:00Z',to:'2026-01-04T23:59:59Z'});
  assert.equal(historyPeriod.status,200);assert(historyPeriod.text.includes('"研究,""引用""\n次の行"'));assert(historyPeriod.text.includes('5'));assert(!historyPeriod.text.includes('99'));
  assert.equal((await request(exportPath,'test-only',{scope:'selected',format:'json',ids:['legacy:'+foreignAssignment._id]})).status,422);
  // Verify formatter parity against immutable recorded baseline when supplied.
  if(process.env.BASELINE_SERVICE){
   const filename=require.resolve('../src/services/surveyApi.service');
   const baseline=new Module(filename,module);baseline.filename=filename;baseline.paths=module.paths;
   baseline._compile(ts.transpileModule(fs.readFileSync(process.env.BASELINE_SERVICE,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019,esModuleInterop:true}}).outputText,filename);
   const fixture=results.concat([{userId:'empty',dataset:{answers:[]}}]);
   assert.deepStrictEqual(SurveyService.getDatasetsOfAssignments(fixture),baseline.exports.SurveyService.getDatasetsOfAssignments(fixture));
  }
  const before=await Assignment.collection.find({userId:'hiroki_u'}).sort({publishAt:-1}).explain('executionStats');
  await Assignment.collection.createIndex({userId:1,publishAt:-1});
  const after=await Assignment.collection.find({userId:'hiroki_u'}).sort({publishAt:-1}).explain('executionStats');
  assert(JSON.stringify(after.queryPlanner.winningPlan).includes('IXSCAN'));
  console.log(JSON.stringify({tests:'passed',baselineDocumentsExamined:before.executionStats.totalDocsExamined,indexedDocumentsExamined:after.executionStats.totalDocsExamined}));
 } finally {await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();}
}
main().catch(async e=>{console.error(e);await mongoose.disconnect();process.exit(1);});
