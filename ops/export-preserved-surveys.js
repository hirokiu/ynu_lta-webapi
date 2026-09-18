const fs=require('fs');
const {MongoClient}=require('/app/node_modules/mongodb');
const converter=require('/app/node_modules/json-2-csv');
const {SurveyService}=require('/app/dist/services/surveyApi.service');
const out='/output';
(async()=>{
 const client=await MongoClient.connect('mongodb://127.0.0.1:27017',{useNewUrlParser:true,useUnifiedTopology:true});
 try {
 const db=client.db('Survey');
 const surveys=await db.collection('surveys').find({}).toArray();
 const assignments=await db.collection('assignments').find({}).toArray();
 const results=await db.collection('assignmentresults').find({}).toArray();
 const counts={};for(const c of await db.listCollections().toArray()) counts[c.name]=await db.collection(c.name).countDocuments({});
 const write=(name,value)=>fs.writeFileSync(`${out}/${name}`,JSON.stringify(value,null,2),{mode:0o600});
 write('counts.json',counts);
 const groups=new Map(surveys.map(s=>[String(s._id),{survey:s,assignments:[],results:[]} ]));
 const byAssignment=new Map();
 for(const a of assignments){const key=a.survey&&a.survey._id?String(a.survey._id):'unmatched';if(!groups.has(key))groups.set(key,{survey:a.survey||null,assignments:[],results:[]});groups.get(key).assignments.push(a);byAssignment.set(String(a._id),key);}
 const orphans=[];
 for(const r of results){const key=byAssignment.get(String(r.assignment));if(key===undefined)orphans.push(r);else groups.get(key).results.push(r);}
 const manifest=[];
 const csv=rows=>new Promise((resolve,reject)=>converter.json2csv(rows,(e,s)=>e?reject(e):resolve(s),{unwindArrays:true}));
 for(const [key,g] of groups){
  write(`${key}.raw.json`,g);
  const answered=g.results.filter(r=>r.dataset&&Array.isArray(r.dataset.answers)&&r.dataset.answers.length);
  const legacy=g.assignments.filter(r=>r.dataset&&Array.isArray(r.dataset.answers)&&r.dataset.answers.length);
  const rows=SurveyService.getDatasetsOfAssignments(answered);
  write(`${key}.answers.json`,rows);
  fs.writeFileSync(`${out}/${key}.answers.csv`,rows.length?await csv(rows):'',{mode:0o600});
  const oldRows=SurveyService.getDatasetsOfAssignments(legacy);
  write(`${key}.legacy-answers.json`,oldRows);
  fs.writeFileSync(`${out}/${key}.legacy-answers.csv`,oldRows.length?await csv(oldRows):'',{mode:0o600});
  if(rows.length!==answered.length||oldRows.length!==legacy.length)throw Error('Export row mismatch');
  manifest.push({surveyId:key,name:g.survey&&g.survey.name,assignments:g.assignments.length,results:g.results.length,answered:answered.length,legacyAnswered:legacy.length});
 }
 write('unmatched-results.raw.json',orphans);write('manifest.json',manifest);
 if(manifest.reduce((n,g)=>n+g.results,0)+orphans.length!==results.length)throw Error('Coverage mismatch');
 console.log(JSON.stringify({surveyDocuments:surveys.length,exportGroups:groups.size,results:results.length,answered:manifest.reduce((n,g)=>n+g.answered,0),legacyAnswered:manifest.reduce((n,g)=>n+g.legacyAnswered,0),unmatchedResults:orphans.length,coverageVerified:true}));
 }finally{await client.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
