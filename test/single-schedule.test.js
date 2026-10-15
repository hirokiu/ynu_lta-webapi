const assert = require('assert');
const firebase = require.resolve('../dist/services/firebaseAdmin.service');
require.cache[firebase] = {id:firebase, filename:firebase, loaded:true, exports:{__esModule:true, default:{}}};
const api = require('../dist/services/surveyApi.service');
api.checkIfAuthenticatedAdmin = (_req,_res,done) => done('synthetic-admin');
for (const stamp of ['2026-10-14T14:59:59Z','2026-10-14T15:00:00Z','2026-10-14T15:00:01Z']) {
 const service = new api.SurveyService(); let captured;
 service.saveNewAssignment = (sid,uid,publish,expire,done) => {captured={sid,uid,publish,expire};done(201,{});};
 const expected = Date.parse(stamp);
 service.scheduleSurveyForUserOnce({method:'POST',url:'/qa'},'synthetic-survey','synthetic-user',String(expected/1000),{status(n){assert.equal(n,201);return this;},send(){}});
 assert(captured.expire instanceof Date);
 assert.equal(captured.publish.getTime(),expected,'publication instant must not change');
 assert.equal(captured.expire.getTime(),expected+60*60*1000,'expiry must be exactly 60 minutes after publication across JST midnight');
}
console.log('PASS single schedule: exact expiry and publication around JST midnight');
