const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('dist/services/firebaseAdmin.service.js','utf8');
function run(env,project){let initialized=false;vm.runInNewContext(source,{exports:{},process:{env},require:name=> name==='fs'?{readFileSync:()=>JSON.stringify({project_id:project})}:{credential:{cert:()=>({})},initializeApp:options=>{initialized=options;}}});return initialized;}
assert.throws(()=>run({},'proto'));
assert.throws(()=>run({GOOGLE_APPLICATION_CREDENTIALS:'/fake',FIREBASE_PROJECT_ID:'dev'},'proto'));
assert.equal(run({GOOGLE_APPLICATION_CREDENTIALS:'/fake',FIREBASE_PROJECT_ID:'dev'},'dev').projectId,'dev');
assert(!run({GOOGLE_APPLICATION_CREDENTIALS:'/fake',FIREBASE_PROJECT_ID:'dev'},'dev').databaseURL);
console.log('Firebase service account environment isolation passed');
