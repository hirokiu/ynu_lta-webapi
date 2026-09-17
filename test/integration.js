// Run against an isolated disposable database only. Never point this at production.
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
const {Survey,Assignment,AssignmentResults} = require('../src/models/survey.model');
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
 await AssignmentResults.insertMany(results);
 const app=express();new Controller(app);const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const request=(path,token='test-only')=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:server.address().port,path,headers:{token}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text,json:()=>JSON.parse(text)}));}).on('error',reject));
 try {
  assert.equal((await request('/api/admin/assignments','bad')).status,401);
  let first=(await request('/api/admin/assignments?limit=50')).json();
  let second=(await request('/api/admin/assignments?limit=50&page=2')).json();
  assert.equal(first.items.length,50);assert(first.hasMore);assert.equal(new Set([...first.items,...second.items].map(a=>a._id)).size,100);
  assert.equal((await request('/api/admin/assignments?limit=1000')).status,400);
  assert.equal((await request('/api/admin/assignments?t='+encodeURIComponent('[survey]+'))).json().items.length,50);
  assert.equal((await request('/api/admin/assignments?from=2026-02-01&to=2026-02-02')).json().items.length,0);
  assert.equal((await request('/api/admin/surveys')).json().items.length,1);
  const csv=await request(`/api/surveys/${survey._id}/datasets/results/csv?from=2026-01-02T00:00:00Z&to=2026-01-02T23:59:59Z`);
  assert.equal(csv.status,200,csv.text);assert(csv.text.includes('回答者ID'));assert(csv.text.includes('2026-01-02 09:00:00'));assert(csv.text.includes('1.50 (90s)'));assert(!csv.text.includes('other'));
  assert.equal((await request(`/api/surveys/${survey._id}/datasets/results/csv?from=bad`)).status,400);
  const mine=(await request('/api/users/hiroki_u/allassignments')).json();assert.equal(mine.length,110);assert.equal(mine.find(a=>a._id===String(assignments[0]._id)).dataset.answers.length,2);
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
