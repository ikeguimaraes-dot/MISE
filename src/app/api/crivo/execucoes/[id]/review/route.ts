import {crivoExecution,crivoError,CrivoError} from '@/lib/crivo/access';
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {id}=await params;const {db,session}=await crivoExecution(id,true);
  const r=await db.schema('mise').rpc('crivo_review_plan',{p_actor:session.employeeId,p_execution:id});
  if(r.error)throw new CrivoError(r.error.code==='P0001'?r.error.message:'Revisão não concluída.',409);
  return Response.json({ok:true});
 }catch(e){return crivoError(e)}
}
