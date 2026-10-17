// Operator-only tool. Never sends a notification. Run requeue only with API stopped.
// Requeue is limited to records whose hiroki_u creation provenance was reviewed.
const m = require('mongoose'), fs = require('fs');
(async () => {
  const [op, storage, id, kind, expected, manifestPath] = process.argv.slice(2);
  if (process.env.ACCOUNT_SCOPE !== 'proto') throw Error('Proto scope required');
  if (!['list', 'requeue'].includes(op)) throw Error('Use list or requeue');
  if (op === 'requeue' && process.env.KIROKUN_SCHEDULER_STOPPED !== 'true') throw Error('Stop API first');
  await m.connect(process.env.MONGO_URL, {useNewUrlParser:true,useUnifiedTopology:true});
  try {
    const db = m.connection.db;
    if (op === 'list') {
      for (const name of ['assignments','assignmentresults']) for (const k of ['publish','expire']) {
        const rows = await db.collection(name).find({[k+'NotificationStartedAt']:{$exists:true},[k+'NotifiedAt']:{$exists:false}})
          .project({_id:1,[k+'NotificationStartedAt']:1,[k+'NotificationState']:1,expireAt:1}).limit(101).toArray();
        console.log(JSON.stringify({collection:name,kind:k,rows:rows.slice(0,100),more:rows.length>100}));
      }
      return;
    }
    if (!['assignments','assignmentresults'].includes(storage) || !['publish','expire'].includes(kind) || !/^[a-f0-9]{24}$/.test(id)) throw Error('Invalid target');
    const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    if (manifest.environment !== 'proto' || manifest.createdBy !== 'hiroki_u' || !manifest.records.some(r=>r.collection===storage && r.id===id)) throw Error('Not a reviewed hiroki_u-created target');
    const c = db.collection(storage), started=kind+'NotificationStartedAt', state=kind+'NotificationState', marker=kind+'NotifiedAt';
    const a = await c.findOne({_id:new m.Types.ObjectId(id)});
    if (!a || !(a[started] instanceof Date) || a[started].toISOString() !== expected || a[marker] || !['pending','review_required'].includes(a[state])) throw Error('State changed or not reviewable');
    if (!(a.expireAt instanceof Date) || a.expireAt <= new Date()) throw Error('Expired: do not resend');
    const r = await c.updateOne({_id:a._id,[started]:a[started],[state]:a[state],[marker]:{$exists:false}}, {
      $unset:{[started]:'',[state]:''},
      $push:{notificationReviewHistory:{kind,previousStartedAt:a[started],previousState:a[state],requeuedAt:new Date(),operator:'hiroki_u'}}
    });
    if (r.modifiedCount !== 1) throw Error('Concurrent change');
    console.log('Requeued one reviewed target; no notification sent. Verify time window before restarting API.');
  } finally { await m.disconnect(); }
})().catch(e=>{console.error(e.message);process.exitCode=1});
