const assert=require('assert'),m=require('mongoose');
const {answerWriteGuard}=require('../dist/utils/answerWindow');
(async()=>{
const uri=process.env.TEST_MONGO_URL || '';
assert(/\/kirokun_dev_finish_guard_test$/.test(uri),'Use only the dedicated test database');
await m.connect(uri,{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
assert.equal(m.connection.name,'kirokun_dev_finish_guard_test');
const collection='answer_guard_'+Date.now(); const c=m.connection.db.collection(collection); const model=m.model('GuardQa',new m.Schema({publishAt:Date,expireAt:Date,dataset:{answers:[{index:Number,type:{type:String},stringValue:String}]}}),collection);
try {
const now=Date.now();
await c.insertMany([{label:'open',publishAt:new Date(now-60000),expireAt:new Date(now+60000)}, {label:'closed',publishAt:new Date(now-60000),expireAt:new Date(now-1)}, {label:'future',publishAt:new Date(now+60000),expireAt:new Date(now+120000)}, {label:'missing',publishAt:new Date(now-60000)}]);
const write=async id=>{ const r=await model.findOneAndUpdate({label:id,...answerWriteGuard()},{$set:{dataset:{answers:[{index:1,type:'open',stringValue:'synthetic'}]}}},{new:true}).exec();return {modifiedCount:r?1:0};};
for(const id of ['closed','future','missing']) assert.equal((await write(id)).modifiedCount,0,id);
const results=await Promise.all([write('open'),write('open')]);
assert.equal(results.reduce((n,r)=>n+r.modifiedCount,0),1,'exactly one concurrent write');
assert.equal((await write('open')).modifiedCount,0,'retry cannot overwrite');
console.log('PASS MongoDB: closed/future/missing denied; concurrent answers and retry preserve first answer');
}finally{await c.drop();await m.disconnect();}
})().catch(e=>{console.error(e.message);process.exit(1)});
