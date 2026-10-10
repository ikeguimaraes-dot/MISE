import {crivoContext,crivoError,CrivoError} from '@/lib/crivo/access';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const {db,session}=await crivoContext();if(session.role!=='admin')throw new CrivoError('Acesso restrito.',403);
 const {id}=await params,body=await request.json();if(!Array.isArray(body.topicos)||!Array.isArray(body.itens))throw new CrivoError('Ordenação inválida.');
 const r=await db.schema('mise').rpc('checklist_reorder',{p_actor:session.employeeId,p_template:id,p_topics:body.topicos,p_items:body.itens});
 if(r.error)throw new CrivoError(r.error.code==='P0001'?r.error.message:'Não foi possível reordenar.',409);
 return Response.json({ok:true});}catch(e){return crivoError(e)}
}
