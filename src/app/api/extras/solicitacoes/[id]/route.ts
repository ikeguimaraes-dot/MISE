import { extrasContext, requireExtraRead, requireUuid, ExtraError, extraResponseError, EXTRA_SELECT } from '@/lib/extras/access'
import { REQUEST_SELECT } from '@/lib/extras/positions'
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {db,grants,session}=await extrasContext(),{id}=await params;requireUuid(id)
  const result=await db.schema('mise').from('extra_request_summary').select(REQUEST_SELECT).eq('id',id).single()
  if(result.error||!result.data)throw new ExtraError('Solicitação não encontrada.',404)
  requireExtraRead(grants,result.data.unit_id,result.data.mise_requested_by,session.employeeId)
  const mayIdentify=grants.some(g=>g.unit_id===result.data.unit_id&&['rh','financeiro','caixa'].includes(g.role))
  const [events,people]=await Promise.all([
   db.schema('mise').from('extra_request_events').select('id,actor_role,action,from_status,to_status,note,created_at').eq('request_id',id).order('created_at'),
   db.from('op_extra').select(mayIdentify?`${EXTRA_SELECT},cpf`:EXTRA_SELECT).eq('solicitacao_id',id).order('mise_position')
  ])
  if(events.error||people.error)throw new ExtraError('Não foi possível carregar pessoas e histórico.',503)
  return Response.json({item:result.data,events:events.data,people:people.data},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){return extraResponseError(e)}
}
