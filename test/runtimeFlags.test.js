const assert = require('assert');
const {notificationsEnabled, preparationEnabled}=require('../dist/utils/runtimeFlags');
assert(preparationEnabled({}));
assert(!preparationEnabled({NOTIFICATIONS_ENABLED:'false'}));
assert(preparationEnabled({NOTIFICATIONS_ENABLED:'false',ASSIGNMENT_PREPARATION_ENABLED:'true'}));
assert(!notificationsEnabled({NOTIFICATIONS_ENABLED:'false',ASSIGNMENT_PREPARATION_ENABLED:'true'}));
assert(!preparationEnabled({NOTIFICATIONS_ENABLED:'true',ASSIGNMENT_PREPARATION_ENABLED:'false'}));
// Exercise the send guard with a fake Firebase sender; never contact Firebase.
const firebasePath=require.resolve('../dist/services/firebaseAdmin.service');
let sent=0;require.cache[firebasePath]={id:firebasePath,filename:firebasePath,loaded:true,exports:{__esModule:true,default:{messaging:()=>({send:()=>{sent++;return Promise.resolve();}})}}};
const {CloudMessageService}=require('../dist/services/cloudMessage.service');
process.env.NOTIFICATIONS_ENABLED='false';new CloudMessageService().sendMessage('fake');assert.equal(sent,0);
process.env.NOTIFICATIONS_ENABLED='true';new CloudMessageService().sendMessage('fake');assert.equal(sent,1);
console.log('Preparation/notification separation and final send guard passed');
