import {AppError} from './archive';
export async function limitedBody(req:Request,limit:number):Promise<Uint8Array>{
 if(Number(req.headers.get('content-length')||0)>limit)throw new AppError('Požiadavka je príliš veľká.',413);
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AppError('Požiadavka je príliš veľká.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}
