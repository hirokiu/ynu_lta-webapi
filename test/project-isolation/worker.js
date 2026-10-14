// TEST ONLY. Firebase verification is replaced with fixed synthetic identities, never deploy this file.
const assert=require('assert'),mongoose=require('mongoose'),express=require('express');
const side=process.env.LAB_SIDE;
assert(['a','b'].includes(side));
const uri=process.env.TEST_MONGO_URL;
assert(uri===`mongodb://127.0.0.1:${side==='a'?37031:37032}/kirokun_isolation_test`);
process.env.ACCOUNT_SCOPE='lab-'+side;process.env.AUTH_MODE='uid';process.env.USERNAME_ACCOUNTS_ENABLED='false';
process.env.NOTIFICATIONS_ENABLED='false';process.env.ASSIGNMENT_PREPARATION_ENABLED='false';
process.env.AUTH_IDENTITY_MAP=JSON.stringify({['owner-'+side]:{userId:'same-name',isAdmin:true},shared:{userId:'shared-member',isAdmin:side==='a'}});
const fp=require.resolve('../../src/services/firebaseAdmin.service');
require.cache[fp]={id:fp,filename:fp,loaded:true,exports:{__esModule:true,default:{
 auth:()=>({verifyIdToken:async token=>{
  if(!['owner-a','owner-b','shared'].includes(token))throw Error('unauthorized');
  return {uid:token};
 }})
}}};
const {Controller}=require('../../src/main.controller');
const {Survey}=require('../../src/models/survey.model');
const {ProjectSettings}=require('../../src/projects/settings');
(async()=>{
 await mongoose.connect(uri,{useNewUrlParser:true,useUnifiedTopology:true});
 await mongoose.connection.dropDatabase();
 await Survey.create({_id:'aaaaaaaaaaaaaaaaaaaaaaaa',name:'Only project '+side,title:'Synthetic '+side,questions:[]});
 await ProjectSettings.create({_id:'lab-'+side,displayName:'Project '+side,subtitle:'Only '+side,revision:1});
 const app=express();app.use(express.json());new Controller(app);
 const server=app.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
 process.on('SIGTERM',()=>server.close(()=>mongoose.disconnect().then(()=>process.exit())));
})().catch(e=>{console.error(e);process.exit(1)});
