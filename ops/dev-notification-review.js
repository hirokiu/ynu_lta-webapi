// Run with NOTIFICATIONS_ENABLED=false after the scheduler is stopped.
// Only explicitly allowlisted Dev QA recipients may be requeued.
const m=require('mongoose');
(async()=>{
 if(process.env.ACCOUNT_SCOPE!=='dev'||process.env.NOTIFICATIONS_ENABLED!=='false')throw Error('Dev with notifications disabled required');
 const [operation,id,kind,expected]=process.argv.slice(2);
 if(!['inspect','requeue'].includes(operation)||!['publish','expire'].includes(kind)||!m.Types.ObjectId.isValid(id))throw Error('Usage: inspect|requeue ID publish|expire [expectedStartedAtISO]');
 await m.connect(process.env.MONGO_URL,{useNewUrlParser:true,useUnifiedTopology:true});
 try{
 const c=m.connection.db.collection('assignments'), key=kind+'NotificationStartedAt',state=kind+'NotificationState',marker=kind+'NotifiedAt';
 const a=await c.findOne({_id:new m.Types.ObjectId(id)});
 const allowed=(process.env.DEV_QA_NOTIFICATION_USERS||'').split(',');
 if(!a||!allowed.includes(a.userId))throw Error('Not an allowlisted QA assignment');
 if(operation==='inspect'){console.log(JSON.stringify({id,kind,state:a[state]||null,startedAt:a[key]||null,acceptedAt:a[marker]||null}));return;}
 if(!expected||!a[key]||new Date(expected).getTime()!==a[key].getTime()||a[marker]||!['pending','review_required'].includes(a[state]))throw Error('State changed or not reviewable');
 if(a.expireAt<=new Date())throw Error('Expired; do not resend');
 const result=await c.updateOne({_id:a._id,[key]:new Date(expected),[marker]:{$exists:false},[state]:a[state]},{$unset:{[key]:'',[state]:''},$push:{notificationReviewHistory:{kind,previousStartedAt:a[key],previousState:a[state],requeuedAt:new Date()}}});
 if(result.modifiedCount!==1)throw Error('Concurrent state change');
 console.log('Requeued once; no notification sent by this command. Check scheduler date window before enabling.');
 }finally{await m.disconnect()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
