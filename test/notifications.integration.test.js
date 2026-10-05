// Disposable local MongoDB; no Firebase credentials or real notifications.
const assert=require('assert'),crypto=require('crypto'),mongoose=require('mongoose');
let delivery='accepted', sends=0;
const firebasePath=require.resolve('../dist/services/firebaseAdmin.service');
require.cache[firebasePath]={id:firebasePath,filename:firebasePath,loaded:true,exports:{__esModule:true,default:{messaging:()=>({send:async()=>{sends++;if(delivery==='failed')throw Error('synthetic');return 'synthetic-id';}})}}};
const {CloudMessageService}=require('../dist/services/cloudMessage.service');
const {SurveyService}=require('../dist/services/surveyApi.service');
const {Assignment,AssignmentResults,User}=require('../dist/models/survey.model');
(async()=>{
 const sender=new CloudMessageService();process.env.NOTIFICATIONS_ENABLED='false';assert.equal(await sender.sendMessage('synthetic-token'),false);assert.equal(sends,0);
 process.env.NOTIFICATIONS_ENABLED='true';assert.equal(await sender.sendMessage(''),false);assert.equal(sends,0);
 delivery='failed';assert.equal(await sender.sendMessage('synthetic-token'),false);
 delivery='accepted';assert.equal(await sender.sendMessage('synthetic-token'),true);
 await mongoose.connect('mongodb://127.0.0.1:27071/kirokun_notifications_'+crypto.randomBytes(6).toString('hex'),{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
 try {
  await User.create({userId:'qa',deviceToken:'synthetic-token'});
  const survey={publishNotificationTitle:'publish',publishNotificationBody:'test',expireNotificationTitle:'expire',expireNotificationBody:'test'};
  const dates={publishAt:new Date(Date.now()-1000),expireAt:new Date(Date.now()+60000)};
  const individual=await Assignment.create({userId:'qa',survey,...dates});
  const group=await Assignment.create({groupId:'qa-group',survey,...dates});
  const recipient=await AssignmentResults.create({userId:'qa',assignment:group._id,...dates});
  const missing=await AssignmentResults.create({userId:'qa',assignment:new mongoose.Types.ObjectId(),...dates});
  const noToken=await Assignment.create({userId:'no-token',survey,...dates});
  const runner=new SurveyService();let calls=0;
  await runner.FindRegistrationTokensForNotification(async()=>{calls++;return false});assert.equal(calls,4);
  assert.equal((await Assignment.findById(individual._id)).publishNotifiedAt,undefined);
  assert.equal((await AssignmentResults.findById(recipient._id)).expireNotifiedAt,undefined);
  calls=0;await runner.FindRegistrationTokensForNotification(async()=>{calls++;throw Error('provider unavailable')});assert.equal(calls,4);
  let release,entered;const started=new Promise(r=>entered=r);const blocked=new Promise(r=>release=r);
  calls=0;const first=runner.FindRegistrationTokensForNotification(async()=>{calls++;if(calls===1){entered();await blocked;}return true});
  await started;await runner.FindRegistrationTokensForNotification(async()=>{throw Error('must not overlap')});assert.equal(calls,1);release();await first;assert.equal(calls,4);
  for(const row of [await Assignment.findById(individual._id),await AssignmentResults.findById(recipient._id)]){assert(row.publishNotifiedAt);assert(row.expireNotifiedAt);}
  assert.equal((await Assignment.findById(group._id)).publishNotifiedAt,undefined);
  assert.equal((await AssignmentResults.findById(missing._id)).publishNotifiedAt,undefined);
  assert.equal((await Assignment.findById(noToken._id)).publishNotifiedAt,undefined);
  let repeats=0;await runner.FindRegistrationTokensForNotification(async()=>{repeats++;return true});assert.equal(repeats,0);
  console.log('PASS: disabled/empty/failure/success sender; personal/group publish and expiry; retry, orphan/missing-token skip, overlap guard, accepted markers. No real push sent.');
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
