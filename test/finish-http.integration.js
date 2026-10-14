// Real HTTP and Mongo; synthetic Firebase identity only. No real notification.
process.env.ACCOUNT_SCOPE='dev';
const assert=require('assert'),express=require('express'),mongoose=require('mongoose');
const firebase=require.resolve('../dist/services/firebaseAdmin.service');
require.cache[firebase]={id:firebase,filename:firebase,loaded:true,exports:{__esModule:true,default:{auth:()=>({verifyIdToken:async token=>{if(!['qa','other','admin'].includes(token))throw Error('invalid');return {uid:token}}})}}};
const identity=require.resolve('../dist/accounts/identity');
require.cache[identity]={id:identity,filename:identity,loaded:true,exports:{resolveAccountIdentity:async info=>({userId:info.uid,isAdmin:info.uid==='admin'})}};
const {SurveyService}=require('../dist/services/surveyApi.service');
const {Assignment,AssignmentResults,Group,Survey}=require('../dist/models/survey.model');
(async()=>{
 const uri='mongodb://127.0.0.1:27071/kirokun_finish_http_'+Date.now();
 await mongoose.connect(uri,{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
 const service=new SurveyService(),app=express();app.use(express.json());
 app.post('/users/:uid/assignments/:aid/datasets',service.addNewDataset);
 app.get('/surveys/:sid/results',(req,res)=>service.getSurveyResultsPage(req,res));
 app.post('/surveys/:sid/export',(req,res)=>service.getAllDatasetsOfSurvey_ar(req,res,req.body.format));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const post=async(aid,token='qa',user='qa',value='synthetic')=>fetch(`http://127.0.0.1:${server.address().port}/users/${user}/assignments/${aid}/datasets`,{method:'POST',headers:{token,'Content-Type':'application/json'},body:JSON.stringify({answers:[{index:1,type:'open',stringValue:value}]})});
 try{
  await Group.create({groupId:'qa-group',userIds:['qa']});
  const survey=await Survey.create({name:'qa-export',title:'Synthetic export'});
  for(const grouped of [false,true])for(const state of ['open','future','expired','missing']){
   const now=Date.now(),dates={publishAt:new Date(now+(state==='future'?60000:-60000)),...(state==='missing'?{}:{expireAt:new Date(now+(state==='expired'?-1:120000))})};
   const a=await Assignment.create(grouped?{groupId:'qa-group',survey:survey.toObject()}:{userId:'qa',survey:survey.toObject(),...dates});
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
  const base=`http://127.0.0.1:${server.address().port}/surveys/${survey._id}`;
  const page=await (await fetch(base+'/results?limit=1',{headers:{token:'admin'}})).json();
  assert.equal(page.total,2);assert.equal(page.items.length,1);
  const exportRows=async(format,scope='all',ids)=>{
   const r=await fetch(base+'/export',{method:'POST',headers:{token:'admin','Content-Type':'application/json'},body:JSON.stringify({format,scope,...(ids?{ids}:{})})});
   assert.equal(r.status,200);assert.equal(r.headers.get('x-export-timezone'),'Asia/Tokyo');return r.text();
  };
  const json=JSON.parse(await exportRows('json'));assert.equal(json.length,2);
  const csv=(await exportRows('csv')).trim().split('\n').map(l=>l.split(','));
  assert.equal(csv.length,3);for(let n=0;n<2;n++)for(let k=0;k<csv[0].length;k++)assert.equal(csv[n+1][k],String(json[n][csv[0][k]]));
  const selected=JSON.parse(await exportRows('json','selected',[page.items[0]._id]));assert.equal(selected.length,1);
  console.log('PASS export HTTP: both storage formats, pagination independent, selected row, CSV/JSON values, timezone');
  console.log('PASS HTTP: personal/group; auth/ownership; open/future/expired/missing; concurrent submission/retry; stored answer preserved');
 }finally{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
