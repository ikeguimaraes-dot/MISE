import { crivoExecution, crivoError } from '@/lib/crivo/access';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {id}=await params;
  const {db,execution}=await crivoExecution(id);
  const {data,error}=await db.schema('mise').from('checklist_responses').select('*').eq('execution_id',id);
  if(error)throw new Error('Respostas indisponíveis.');
  const {responsavel_unidade_cpf: _privateCpf,...safe}=execution;
  return Response.json({execucao:safe,respostas:data??[]},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return crivoError(e)}
}
