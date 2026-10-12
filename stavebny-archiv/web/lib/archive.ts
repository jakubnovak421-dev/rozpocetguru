import {z} from 'zod';
export class AppError extends Error { constructor(message:string,public status=400){super(message);} }
export function identity(request:Request){
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner || !request.headers.get('oai-authenticated-user-email')) throw new AppError('Prihlás sa cez ChatGPT.',401);
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)throw new AppError('Nepovolený pôvod požiadavky.',403);
 return owner;
}
const str=z.string().trim().max(160), rid=z.string().min(8).max(120);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Neplatný dátum.');
const fields=z.record(z.string().max(80),z.union([z.string().max(20000),z.number().finite(),z.null()])).refine(o=>Object.keys(o).length<=60,'Priveľa polí.');
export const projectInput=z.object({name:str.min(1),code:str.default(''),location:str.default(''),request_id:rid});
export const recordInput=z.object({project_id:str.min(1),title:str.min(1),kind:z.enum(['water','injection','general','diary']),date,data:fields,request_id:rid});
export const updateInput=recordInput.omit({project_id:true,kind:true}).extend({id:str.min(1),expected_version:z.number().int().positive()});
export const fileInput=z.object({project_id:str.min(1),record_id:str.optional(),name:str.min(1),kind:z.enum(['photo','template','attachment']),request_id:rid});
export const allowedMimes=['image/jpeg','image/png','image/webp','application/pdf'];
export type RecordRow={id:string;owner:string;project_id:string;title:string;kind:string;date:string;data:string;version:number;created:string;updated:string};
function canonical(v:any):string { if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'; }
async function hash(v:string|ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof v==='string'?new TextEncoder().encode(v):v))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function parseRecord(r:RecordRow){return {...r,data:JSON.parse(r.data)};}
export class Archive {
 constructor(public db:D1Database,public bucket:R2Bucket,public owner:string){}
 async replay(key:string,fingerprint:string){const old=await this.db.prepare('SELECT hash,result FROM operations WHERE owner=? AND request_id=?').bind(this.owner,key).first<{hash:string,result:string}>();if(!old)return null;if(old.hash!==fingerprint)throw new AppError('Tento identifikátor požiadavky už patrí iným údajom.',409);return JSON.parse(old.result);}
 async commit(key:string,fingerprint:string,result:unknown,statements:D1PreparedStatement[]){
  try{await this.db.batch([this.db.prepare('INSERT INTO operations(owner,request_id,hash,result,created) VALUES(?,?,?,?,?)').bind(this.owner,key,fingerprint,JSON.stringify(result),new Date().toISOString()),...statements]);return result;}
  catch(error){const old=await this.replay(key,fingerprint);if(old)return old; if(String(error).includes('UNIQUE'))throw new AppError('Záznam medzitým zmenil iný zápis. Načítaj aktuálnu verziu.',409);throw error;}
 }
 async project(id:string){const p=await this.db.prepare('SELECT * FROM projects WHERE id=? AND owner=?').bind(id,this.owner).first();if(!p)throw new AppError('Stavba neexistuje alebo k nej nemáš prístup.',404);return p;}
 async listProjects(){return (await this.db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM records r WHERE r.project_id=p.id AND r.owner=p.owner) AS record_count,(SELECT COUNT(*) FROM files f WHERE f.project_id=p.id AND f.owner=p.owner) AS file_count FROM projects p WHERE p.owner=? ORDER BY p.updated DESC`).bind(this.owner).all()).results;}
 async createProject(input:unknown){const a=projectInput.parse(input),fingerprint=await hash(canonical({action:'project',...a}));const old=await this.replay(a.request_id,fingerprint);if(old)return old;const now=new Date().toISOString(),p={id:crypto.randomUUID(),owner:this.owner,name:a.name,code:a.code,location:a.location,created:now,updated:now};return this.commit(a.request_id,fingerprint,p,[this.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?,?)').bind(p.id,p.owner,p.name,p.code,p.location,now,now)]);}
 async getRecord(id:string){const r=await this.db.prepare('SELECT * FROM records WHERE id=? AND owner=?').bind(id,this.owner).first<RecordRow>();if(!r)throw new AppError('Záznam neexistuje alebo k nemu nemáš prístup.',404);return parseRecord(r);}
 async listRecords(project_id?:string,q=''){if(project_id)await this.project(project_id);return (await this.db.prepare('SELECT * FROM records WHERE owner=? AND (? IS NULL OR project_id=?) AND (title LIKE ? OR data LIKE ?) ORDER BY date DESC,updated DESC LIMIT 500').bind(this.owner,project_id||null,project_id||null,'%'+q.slice(0,120)+'%','%'+q.slice(0,120)+'%').all<RecordRow>()).results.map(parseRecord);}
 async versions(id:string){await this.getRecord(id);return (await this.db.prepare('SELECT version,snapshot,created FROM revisions WHERE record_id=? ORDER BY version DESC').bind(id).all<{version:number,snapshot:string,created:string}>()).results.map(r=>({...r,snapshot:JSON.parse(r.snapshot)}));}
 async createRecord(input:unknown){const a=recordInput.parse(input),fp=await hash(canonical({action:'record',...a}));const old=await this.replay(a.request_id,fp);if(old)return old;await this.project(a.project_id);const now=new Date().toISOString(),r={id:crypto.randomUUID(),owner:this.owner,project_id:a.project_id,title:a.title,kind:a.kind,date:a.date,data:a.data,version:1,created:now,updated:now};return this.commit(a.request_id,fp,r,[this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?)').bind(r.id,r.owner,r.project_id,r.title,r.kind,r.date,JSON.stringify(r.data),1,now,now),this.db.prepare('INSERT INTO revisions VALUES(?,?,?,?)').bind(r.id,1,JSON.stringify(r),now),this.db.prepare('UPDATE projects SET updated=? WHERE id=? AND owner=?').bind(now,r.project_id,this.owner)]);}
 async updateRecord(input:unknown){const a=updateInput.parse(input),fp=await hash(canonical({action:'update',...a}));const old=await this.replay(a.request_id,fp);if(old)return old;const r=await this.getRecord(a.id);if(r.version!==a.expected_version)throw new AppError('Existuje novšia verzia. Znovu otvor záznam.',409);const now=new Date().toISOString(),next={...r,title:a.title,date:a.date,data:a.data,version:r.version+1,updated:now};return this.commit(a.request_id,fp,next,[this.db.prepare('INSERT INTO revisions VALUES(?,?,?,?)').bind(r.id,next.version,JSON.stringify(next),now),this.db.prepare('UPDATE records SET title=?,date=?,data=?,version=?,updated=? WHERE id=? AND owner=? AND version=?').bind(next.title,next.date,JSON.stringify(next.data),next.version,now,r.id,this.owner,r.version),this.db.prepare('UPDATE projects SET updated=? WHERE id=? AND owner=?').bind(now,r.project_id,this.owner)]);}
 async listFiles(project_id?:string){if(project_id)await this.project(project_id);return (await this.db.prepare('SELECT id,project_id,record_id,name,mime,size,kind,created FROM files WHERE owner=? AND (? IS NULL OR project_id=?) ORDER BY created DESC LIMIT 500').bind(this.owner,project_id||null,project_id||null).all()).results;}
 async file(id:string){const f=await this.db.prepare('SELECT * FROM files WHERE id=? AND owner=?').bind(id,this.owner).first<{object_key:string,mime:string,name:string}>();if(!f)throw new AppError('Súbor neexistuje alebo k nemu nemáš prístup.',404);const body=await this.bucket.get(f.object_key);if(!body)throw new AppError('Súbor nie je dostupný.',404);return {f,body};}
 async upload(input:unknown,bytes:ArrayBuffer,mime:string){
  const a=fileInput.parse(input);if(bytes.byteLength>20*1024*1024||bytes.byteLength===0)throw new AppError('Súbor musí mať veľkosť 1 B až 20 MB.');
  if(!allowedMimes.includes(mime))throw new AppError('Podporované sú JPG, PNG, WebP a PDF.');
  const b=new Uint8Array(bytes),ascii=(n:number)=>new TextDecoder().decode(b.slice(0,n));
  const valid=mime==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:mime==='image/png'?b[0]===137&&ascii(8).slice(1)==='PNG\r\n\x1a\n':mime==='image/webp'?ascii(4)==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP':ascii(5)==='%PDF-';
  if(!valid)throw new AppError('Obsah súboru nezodpovedá jeho formátu.');
  const fp=await hash(canonical({action:'upload',...a,mime,sha:await hash(bytes)}));const old=await this.replay(a.request_id,fp);if(old)return old;await this.project(a.project_id);if(a.record_id){const r=await this.getRecord(a.record_id);if(r.project_id!==a.project_id)throw new AppError('Záznam patrí inej stavbe.');}
  const id=crypto.randomUUID(),key='originals/'+id,now=new Date().toISOString(),f={id,project_id:a.project_id,record_id:a.record_id||null,name:a.name,mime,size:bytes.byteLength,kind:a.kind,created:now};
  await this.bucket.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{const result:any=await this.commit(a.request_id,fp,f,[this.db.prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,this.owner,a.project_id,a.record_id||null,a.name,mime,bytes.byteLength,a.kind,key,now),this.db.prepare('UPDATE projects SET updated=? WHERE id=? AND owner=?').bind(now,a.project_id,this.owner)]);if(result.id!==id)await this.bucket.delete(key);return result;}catch(e){/* Retain bytes after uncertain DB failures so a committed file is never lost. */throw e;}
 }
 async getSettings(){return await this.db.prepare('SELECT company,handwriting,last_mcp FROM settings WHERE owner=?').bind(this.owner).first()||{company:'Zakládání staveb',handwriting:0,last_mcp:null};}
 async setSettings(input:unknown){const a=z.object({company:str.min(1),handwriting:z.boolean()}).parse(input);await this.db.prepare('INSERT INTO settings(owner,company,handwriting) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET company=excluded.company,handwriting=excluded.handwriting').bind(this.owner,a.company,a.handwriting?1:0).run();return this.getSettings();}
 async mcpSeen(){await this.db.prepare("INSERT INTO settings(owner,company,handwriting,last_mcp) VALUES(?,'Zakládání staveb',0,?) ON CONFLICT(owner) DO UPDATE SET last_mcp=excluded.last_mcp").bind(this.owner,new Date().toISOString()).run();}
}
