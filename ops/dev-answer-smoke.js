// Run inside the Dev API container with private `qa` and public `apiKey` bindings.
// Creates only temporary fixtures, deletes those exact IDs, and never prints tokens.
const assert = require('assert');
const mongoose = require('mongoose');
const crypto = require('crypto');
assert.equal(process.env.FIREBASE_PROJECT_ID, 'kirokun-dev');
assert.equal(process.env.ACCOUNT_SCOPE, 'dev');
assert.equal(process.env.NOTIFICATIONS_ENABLED, 'false');
assert.equal(process.env.ASSIGNMENT_PREPARATION_ENABLED, 'false');
assert(/^qa_auth_[0-9]+$/.test(qa.username));
const {Assignment, AssignmentResults, Group} = require('./dist/models/survey.model');
const {Account} = require('./dist/accounts/models');
const ids = {assignments: [], results: [], groups: []};
async function call(path, body, token) {
  const r = await fetch('http://127.0.0.1:9001/api/' + path, {
    method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json', ...(token ? {token} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(15000)
  });
  const text = await r.text(); let data; try {data = JSON.parse(text)} catch (_) {data = text}
  return {status: r.status, data};
}
(async () => {
  await mongoose.connect(process.env.MONGO_URL, {useNewUrlParser:true, useUnifiedTopology:true});
  try {
    const account = await Account.findOne({username:qa.username}).lean();
    assert(account && account.userId === qa.userId && account.uid === qa.uid);
    const login = await call('auth/username-login', {username:qa.username, password:qa.password});
    assert.equal(login.status, 200);
    const exchange = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + apiKey, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token:login.data.customToken, returnSecureToken:true}), signal:AbortSignal.timeout(15000)
    });
    assert.equal(exchange.status, 200);
    const token = (await exchange.json()).idToken; assert(token);
    assert.equal((await call('me', null, token)).data.userId, qa.userId);
    const suffix = crypto.randomBytes(12).toString('hex');
    const own = await Assignment.create({userId:qa.userId}); ids.assignments.push(own._id);
    const other = await Assignment.create({userId:'qa_unowned_' + suffix}); ids.assignments.push(other._id);
    const group = await Group.create({groupId:'qa_answer_' + suffix, userIds:[qa.userId]}); ids.groups.push(group._id);
    const grouped = await Assignment.create({groupId:group.groupId}); ids.assignments.push(grouped._id);
    const answers = {answers:[{index:1,type:'open',stringValue:'招待ユーザーの合成回答'}]};
    const submit = id => call('users/' + qa.userId + '/assignments/' + id + '/datasets', answers, token);
    assert.equal((await submit(own._id)).status, 200);
    assert.equal((await Assignment.findById(own._id)).dataset.answers[0].stringValue, answers.answers[0].stringValue);
    assert.equal((await submit(other._id)).status, 403);
    assert.equal((await Assignment.findById(other._id)).dataset, undefined);
    assert.equal((await submit(grouped._id)).status, 404);
    const recipient = await AssignmentResults.create({assignment:grouped._id,userId:qa.userId}); ids.results.push(recipient._id);
    assert.equal((await submit(grouped._id)).status, 201);
    assert.equal((await AssignmentResults.findById(recipient._id)).dataset.answers[0].stringValue, answers.answers[0].stringValue);
    await Group.updateOne({_id:group._id}, {$set:{userIds:[]}});
    assert.equal((await submit(grouped._id)).status, 403);
  } finally {
    await AssignmentResults.deleteMany({_id:{$in:ids.results}});
    await Assignment.deleteMany({_id:{$in:ids.assignments}});
    await Group.deleteMany({_id:{$in:ids.groups}});
    assert.equal(await AssignmentResults.countDocuments({_id:{$in:ids.results}}), 0);
    assert.equal(await Assignment.countDocuments({_id:{$in:ids.assignments}}), 0);
    assert.equal(await Group.countDocuments({_id:{$in:ids.groups}}), 0);
    await mongoose.disconnect();
  }
  console.log('PASS: real Dev username/Firebase login, identity, personal/group answer persistence, unauthorized/missing recipient rejection; temporary fixtures removed. No mobile UI or push test.');
})().then(() => process.exit(0)).catch(() => {console.error('FAIL: Dev answer smoke assertion or cleanup failed; inspect privately.'); process.exit(1)});
