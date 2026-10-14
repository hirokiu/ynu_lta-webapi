const fs=require('fs');
const mongoose=require('/app/node_modules/mongoose');
mongoose.set('autoIndex',false);
const {Survey,Assignment,AssignmentResults}=require('/app/dist/models/survey.model');
const {combinedAnswerCursor,surveyAnswerPage}=require('/app/dist/utils/surveyAnswers');
const {exportFile}=require('/app/dist/utils/exportFile');
const {SurveyService}=require('/app/dist/services/surveyApi.service');
function parseCsv(text) {
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++) {const c=text[i];
  if(c==='"') {if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(value);value='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}
  else value+=c;
 }
 assert(!quoted,'unclosed CSV quote');
 if(row.length||value.length){row.push(value);rows.push(row);}
 return rows;
}
const {EventEmitter}=require('events');
const assert=require('assert');
(async()=>{
 await mongoose.connect(process.env.MONGO_URL||'mongodb://mongodb:27017/Survey',{useNewUrlParser:true,useUnifiedTopology:true,autoIndex:false});
 const surveys=await Survey.find({}).select('_id').lean();const report=[];
 for(const survey of surveys){
  const assignments=await Assignment.find({'survey._id':survey._id}).select('_id userId dataset.answers.index').lean();
  const ids=assignments.map(a=>a._id);
  const modern=await AssignmentResults.find({assignment:{$in:ids},'dataset.answers.0':{$exists:true}}).select('assignment userId').lean();
  const pairs=new Set(modern.map(a=>String(a.assignment)+'/'+a.userId));
  const old=assignments.filter(a=>a.dataset&&a.dataset.answers&&a.dataset.answers.length);
  const legacy=old.filter(a=>!pairs.has(String(a._id)+'/'+a.userId));
  const expected=modern.length+legacy.length;
  const page=await surveyAnswerPage(String(survey._id),0,50);
  assert.equal(page.total,expected);assert.equal(page.items.length,Math.min(50,expected));
  const item={surveyId:String(survey._id),modern:modern.length,legacy:legacy.length,overlap:old.length-legacy.length,total:expected};
  let jsonRows;
  for(const format of ['json','csv']){
   console.log('VERIFYING',String(survey._id),format,expected);
   let received=false;const res=new EventEmitter();
   res.setHeader=()=>{};res.type=()=>res;res.status=n=>{throw Error('export status '+n)};res.json=()=>{throw Error('export failed')};
   res.sendFile=(file,callback)=>{(async()=>{
    const text=await fs.promises.readFile(file,'utf8');
    let rows;
    if(format==='json'){rows=JSON.parse(text);jsonRows=rows;}
    else {const cells=parseCsv(text),header=cells.shift()||[];rows=cells;
     for(let n=0;n<rows.length;n++){assert.equal(rows[n].length,header.length);for(let k=0;k<header.length;k++)assert.equal(rows[n][k],String(jsonRows[n][header[k]]),'CSV/JSON cell mismatch column='+header[k]+' csvLength='+rows[n][k].length+' jsonLength='+String(jsonRows[n][header[k]]).length);}
    }
    assert.equal(rows.length,expected,'export coverage '+survey._id+' '+format);
    item[format+'Bytes']=Buffer.byteLength(text);received=true;
   })().then(()=>callback(),e=>{console.error('VALIDATION_ERROR',format,String(survey._id),e.message);callback(e)})};
   await exportFile(res,()=>combinedAnswerCursor(String(survey._id)),format,r=>SurveyService.getDatasetsOfAssignments(r,'Asia/Tokyo'));
   assert(received);
  }
  report.push(item);
 }
 const orphan=await AssignmentResults.aggregate([{$match:{'dataset.answers.0':{$exists:true}}},{$lookup:{from:'assignments',localField:'assignment',foreignField:'_id',as:'a'}},{$match:{'a.0':{$exists:false}}},{$count:'count'}]);
 console.log('AUDIT_REPORT '+JSON.stringify({surveys:report.length,answers:report.reduce((n,r)=>n+r.total,0),orphanAnswered:orphan[0]?orphan[0].count:0,report}));
 await mongoose.disconnect();
})().then(()=>process.exit(0)).catch(e=>{console.error('AUDIT_FAILED',e.message);process.exit(1)});
