import {limitedBody} from './body';
import {env} from 'cloudflare:workers';
import {Archive,identity,AppError} from './archive';
import {ZodError} from 'zod';
export function archive(req:Request){const owner=identity(req);if(!env.DB||!env.BUCKET)throw new AppError('Úložisko zatiaľ nie je dostupné.',503);return new Archive(env.DB,env.BUCKET,owner);}
export function errorResponse(e:unknown){return Response.json({error:e instanceof ZodError?'Skontroluj vyplnené údaje.':e instanceof AppError?e.message:'Uloženie sa nepodarilo. Skús to znova.'},{status:e instanceof AppError?e.status:e instanceof ZodError?400:500,headers:{'Cache-Control':'no-store'}});}
export function json(value:unknown){return Response.json(value,{headers:{'Cache-Control':'no-store'}});}
export async function readJson(req:Request){const text=new TextDecoder().decode(await limitedBody(req,150000));try{return JSON.parse(text);}catch{throw new AppError('Neplatný JSON.');}}
