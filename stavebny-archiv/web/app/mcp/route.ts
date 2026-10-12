import {limitedBody} from '@/lib/body';
import {archive,json,errorResponse} from '@/lib/server';
import {AppError} from '@/lib/archive';
import {ZodError} from 'zod';
const s={type:'string'}, request_id={type:'string',minLength:8,description:'Unique operation ID. Reuse exactly on retries of the same operation; use a new ID for changed content.'};
const recordProps={project_id:s,title:s,kind:{type:'string',enum:['water','injection','general','diary']},date:{type:'string',description:'YYYY-MM-DD. Ask for missing date; never infer measurements.'},data:{type:'object',additionalProperties:{type:['string','number','null']},description:'User-supplied fields only. Preserve unknowns as null or empty. Keys for water: vrt, etaz, hlbka, voda, minuty, tlak, poznamka. Calculated flow is displayed separately.'},request_id};
function tool(name:string,description:string,properties:any,required:string[],read=true){return {name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:read,destructiveHint:false,idempotentHint:true,openWorldHint:false}};}
const tools=[
 tool('list_projects','List the signed-in user’s construction projects. Select the exact project; ask if ambiguous.',{},[]),
 tool('create_project','Create a construction project when requested.',{name:s,code:s,location:s,request_id},['name','request_id'],false),
 tool('search_records','Search records and diary entries; results are capped at 500.',{project_id:s,q:s},[]),
 tool('get_record','Read a record and immutable revision history.',{id:s},['id']),
 tool('create_record','Save a record or diary entry to a confirmed project. Never invent illegible or missing values.',recordProps,['project_id','title','kind','date','data','request_id'],false),
 tool('update_record','Save a new version. Read current record first. Supply complete data; do not drop existing fields.',{id:s,title:s,date:recordProps.date,data:recordProps.data,expected_version:{type:'integer',minimum:1},request_id},['id','title','date','data','expected_version','request_id'],false),
 tool('list_files','List original photos, templates and attachments. Returned URLs require the signed-in user.',{project_id:s},[]),
 tool('attach_file','Store actual JPEG, PNG, WebP or PDF bytes as base64, max 5 MB. Do not invent bytes or pass a URL. Use only if the file bytes are available to the caller.',{project_id:s,record_id:s,name:s,kind:{type:'string',enum:['photo','template','attachment']},mime:{type:'string',enum:['image/jpeg','image/png','image/webp','application/pdf']},base64:s,request_id},['project_id','name','kind','mime','base64','request_id'],false)
];
export async function POST(req:Request){let id:any=null;try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new AppError('Forbidden origin',403);
 const text=new TextDecoder().decode(await limitedBody(req,7200000));
 let b:any;try{b=JSON.parse(text);}catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
 id=b.id??null;
 if(b.jsonrpc!=='2.0'||typeof b.method!=='string')return json({jsonrpc:'2.0',id,error:{code:-32600,message:'Invalid request'}});
 if(b.method.startsWith('notifications/'))return new Response(null,{status:202});
 const reply=(result:unknown)=>json({jsonrpc:'2.0',id,result});
 if(b.method==='initialize')return reply({protocolVersion:'2024-11-05',capabilities:{tools:{listChanged:false}},serverInfo:{name:'stavebny-archiv',version:'1.0.0'},instructions:'Private construction archive. Get exact project first. Never invent measurements, dates, signatures or file bytes. Repeat request_id only for an identical operation. Report save success only after a successful tool response.'});
 if(b.method==='ping')return reply({});
 if(b.method==='tools/list')return reply({tools});
 if(b.method!=='tools/call')return json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
 const a=archive(req),p=b.params||{},v=p.arguments||{};let result:any;
 try{switch(p.name){
 case'list_projects':result=await a.listProjects();break;
 case'create_project':result=await a.createProject(v);break;
 case'search_records':result=await a.listRecords(v.project_id,v.q);break;
 case'get_record':result={record:await a.getRecord(v.id),versions:await a.versions(v.id)};break;
 case'create_record':result=await a.createRecord(v);break;
 case'update_record':result=await a.updateRecord(v);break;
 case'list_files':result=(await a.listFiles(v.project_id)).map(f=>({...f,url:new URL('/api/files/'+f.id,req.url).href}));break;
 case'attach_file':{if(typeof v.base64!=='string'||v.base64.length>7000000||typeof v.mime!=='string')throw new AppError('Súbor môže mať najviac 5 MB.');let bytes;try{bytes=Uint8Array.from(atob(v.base64),c=>c.charCodeAt(0));}catch{throw new AppError('Neplatné base64 dáta.');}if(bytes.length>5*1024*1024)throw new AppError('Súbor môže mať najviac 5 MB.');result=await a.upload(v,bytes.buffer,v.mime);break;}
 default:return json({jsonrpc:'2.0',id,error:{code:-32602,message:'Unknown tool'}});
 }
 await a.mcpSeen();return reply({content:[{type:'text',text:JSON.stringify(result)}],isError:false});
 }catch(e){return reply({content:[{type:'text',text:e instanceof ZodError?'Invalid input. Check required fields.':e instanceof AppError?e.message:'Operation failed. Retry with the same request_id.'}],isError:true});}
 }catch(e){return errorResponse(e);}}
export async function GET(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
