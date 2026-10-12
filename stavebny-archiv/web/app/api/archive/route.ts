import {archive,json,errorResponse,readJson} from '@/lib/server';
import {AppError} from '@/lib/archive';
export async function GET(req:Request){try{const a=archive(req),u=new URL(req.url),p=u.searchParams.get('project')||undefined,action=u.searchParams.get('action');
 if(action==='versions')return json(await a.versions(u.searchParams.get('id')||''));
 if(action==='record')return json(await a.getRecord(u.searchParams.get('id')||''));
 if(action==='search')return json(await a.listRecords(p,u.searchParams.get('q')||''));
 return json({projects:await a.listProjects(),records:await a.listRecords(p),files:await a.listFiles(p),settings:await a.getSettings()});
 }catch(e){return errorResponse(e);}}
export async function POST(req:Request){try{const a=archive(req),b=await readJson(req);switch(b.action){case'create_project':return json(await a.createProject(b));case'create_record':return json(await a.createRecord(b));case'update_record':return json(await a.updateRecord(b));case'settings':return json(await a.setSettings(b));default:throw new AppError('Neznáma operácia.');}}catch(e){return errorResponse(e);}}
