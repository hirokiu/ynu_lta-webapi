// Real HTTP and Mongo; synthetic Firebase identity only. No real notification.
const assert=require('assert'),express=require('express'),mongoose=require('mongoose');
const firebase=require.resolve('../dist/services/firebaseAdmin.service');
require.cache[firebase]={id:firebase,filename:firebase,loaded:true,exports:{__esModule:true,default:{auth:()=>({verifyIdToken:async token=>{if(!['qa','other','admin'].includes(token))throw Error('invalid');return {uid:token}}})}}};
const identity=require.resolve('../dist/accounts/identity');
require.cache[identity]={id:identity,filename:identity,loaded:true,exports:{resolveAccountIdentity:async info=>({userId:info.uid,isAdmin:info.uid==='admin'})}};
const {SurveyService}=require('../dist/services/surveyApi.service');
const {Assignment,AssignmentResults,Group}=require('../dist/models/survey.model');
(async()=>{
 const uri='mongodb://127.0.0.1:27071/kirokun_finish_http_'+Date.now();
 await mongoose.connect(uri,{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
 const service=new SurveyService(),app=express();app.use(express.json());
 app.post('/users/:uid/assignments/:aid/datasets',service.addNewDataset);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const post=async(aid,token='qa',user='qa',value='synthetic')=>fetch(`http://127.0.0.1:${server.address().port}/users/${user}/assignments/${aid}/datasets`,{method:'POST',headers:{token,'Content-Type':'application/json'},body:JSON.stringify({answers:[{index:1,type:'open',stringValue:value}]})});
 try{
  await Group.create({groupId:'qa-group',userIds:['qa']});
  for(const grouped of [false,true])for(const state of ['open','future','expired','missing']){
   const now=Date.now(),dates={publishAt:new Date(now+(state==='future'?60000:-60000)),...(state==='missing'?{}:{expireAt:new Date(now+(state==='expired'?-1:120000))})};
   const a=await Assignment.create(grouped?{groupId:'qa-group'}:{userId:'qa',...dates});
   const recipient=grouped?await AssignmentResults.create({assignment:a._id,userId:'qa',...dates}):a;
   const model=grouped?AssignmentResults:Assignment;
   assert.equal((await post(a._id,'invalid')).status,401);
   assert.equal((await post(a._id,'other')).status,401);
   if(state==='open'){
    const pair=await Promise.all([post(a._id),post(a._id)]);const status=pair.map(r=>r.status).sort();
    assert.deepEqual(status,grouped?[201,409]:[200,409]);
    assert.equal((await post(a._id,'qa','qa','overwrite-attempt')).status,409);
    const stored=await model.findById(recipient._id);assert.equal(stored.dataset.answers[0].stringValue,'synthetic');
   }else{assert.equal((await post(a._id)).status,409);assert(!(await model.findById(recipient._id)).dataset);}
  }
  console.log('PASS HTTP: personal/group; auth/ownership; open/future/expired/missing; concurrent submission/retry; stored answer preserved');
 }finally{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
