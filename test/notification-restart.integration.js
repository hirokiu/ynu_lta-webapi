// Isolated MongoDB and synthetic transport; each pass runs in a fresh OS process.
const assert=require('assert'),mongoose=require('mongoose'),{spawnSync}=require('child_process');
const uri=process.env.RESTART_TEST_URI;
if(process.argv[2]==='worker'){
 assert(/^mongodb:\/\/127\.0\.0\.1:27071\/kirokun_restart_\d+$/.test(uri));
 process.env.ACCOUNT_SCOPE='dev';process.env.DEV_QA_NOTIFICATION_USERS='qa';
 const f=require.resolve('../dist/services/firebaseAdmin.service');
 require.cache[f]={id:f,filename:f,loaded:true,exports:{__esModule:true,default:{}}};
 const {SurveyService}=require('../dist/services/surveyApi.service');
 (async()=>{await mongoose.connect(uri,{useNewUrlParser:true,useUnifiedTopology:true});let calls=0;
 await new SurveyService().FindRegistrationTokensForNotification(async()=>{calls++;if(process.env.CRASH_AFTER_ACCEPT==='true') process.exit(42);return true});
 console.log(JSON.stringify({calls}));await mongoose.disconnect()})().catch(()=>process.exit(1));
}else{
 (async()=>{const db='mongodb://127.0.0.1:27071/kirokun_restart_'+Date.now();await mongoose.connect(db,{useNewUrlParser:true,useUnifiedTopology:true});
 try{const d=mongoose.connection.db;
 await d.collection('users').insertOne({userId:'qa',deviceToken:'synthetic'});
 await d.collection('assignments').insertOne({userId:'qa',survey:{publishNotificationTitle:'test'},publishAt:new Date(Date.now()-1000),expireAt:new Date(Date.now()+3600000)});
 const run=()=>{const r=spawnSync(process.execPath,[__filename,'worker'],{env:{...process.env,RESTART_TEST_URI:db},encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim()).calls};
 assert.equal(run(),1);assert.equal(run(),0);
 await d.collection('assignments').insertOne({userId:'qa',survey:{publishNotificationTitle:'crash'},publishAt:new Date(Date.now()-1000),expireAt:new Date(Date.now()+3600000)});
 const crash=spawnSync(process.execPath,[__filename,'worker'],{env:{...process.env,RESTART_TEST_URI:db,CRASH_AFTER_ACCEPT:'true'},encoding:'utf8'});
 assert.equal(crash.status,42);
 assert.equal(await d.collection('assignments').countDocuments({publishNotificationState:'pending',publishNotifiedAt:{$exists:false}}),1);
 assert.equal(run(),0);
 console.log('PASS: crash inside accepted transport before marker save does not resend; pending review remains');
 console.log('PASS: fresh OS process does not resend persisted accepted notification; synthetic transport');
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
}
