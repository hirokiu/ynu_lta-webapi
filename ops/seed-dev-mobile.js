// Run inside the kirokun-dev API container only. Creates named synthetic fixtures, never resets answers.
if (process.env.FIREBASE_PROJECT_ID !== 'kirokun-dev' || process.env.NOTIFICATIONS_ENABLED !== 'false' || process.env.ASSIGNMENT_PREPARATION_ENABLED !== 'false') throw new Error('Only isolated dev with notifications disabled is allowed');
const mongoose = require('mongoose');
const {Survey, Assignment, User} = require('/app/dist/models/survey.model');
(async () => {
  await mongoose.connect(process.env.MONGO_URL, {useNewUrlParser:true});
  const userId = 'hiroki_u';
  await User.updateOne({userId}, {$setOnInsert:{userId, timezone:'Asia/Tokyo'}}, {upsert:true});
  for (const suffix of ['01','02','03']) {
    const name = '__dev_mobile_smoke_20260918_' + suffix;
    let survey = await Survey.findOne({name});
    if (!survey) survey = await Survey.create({name, title:'開発テスト '+suffix+'・回答保存の確認', questions:[
      {index:0,type:'header',title:'KIROKUN 動作確認',text:'開発用のテストです。実際の研究データは入力しないでください。'},
      {index:1,type:'open',title:'表示と入力の確認',text:'「動作確認」と入力してください。',description:'自由記述のテストです。'},
      {index:2,type:'footer',title:'回答の送信',text:'テスト回答を保存します。送信後に保存完了の表示を確認してください。'}
    ]});
    let assignment = await Assignment.findOne({'survey._id':survey._id,userId});
    if (!assignment) assignment = await Assignment.create({userId,survey:survey.toObject(),publishAt:new Date(Date.now()-60000),expireAt:new Date(Date.now()+14*86400000)});
    console.log(JSON.stringify({fixture:name,assignmentId:String(assignment._id),answered:!!assignment.dataset}));
  }
  await mongoose.disconnect();
})().catch(e=>{console.error(e.message);process.exitCode=1;mongoose.disconnect();});
