import 'server-only';
import {redirect,notFound} from 'next/navigation';
import {crivoContext,crivoExecution,CrivoError} from './crivo/access';
export async function checklistPageContext(){try{return await crivoContext()}catch(e){if(e instanceof CrivoError&&e.status===401)redirect('/login');notFound()}}
export async function checklistPageExecution(id:string,write=false){try{return await crivoExecution(id,write)}catch(e){if(e instanceof CrivoError&&e.status===401)redirect('/login');notFound()}}
