import { after } from 'next/server'
import { extrasContext, requireExtraAccess, requireUuid, ExtraError, extraResponseError, type ExtraRole } from '@/lib/extras/access'
import { REQUEST_SELECT } from '@/lib/extras/positions'
import { validDate } from '@/lib/extras/alcada'
import { dispatchExtraNotifications } from '@/lib/extras/notifications'
export const maxDuration=60
export async function GET(request:Request) {
 try {
  const {db,grants,session}=await extrasContext(),p=new URL(request.url).searchParams
  const unit=requireUuid(p.get('unit_id')),role=p.get('role') as ExtraRole
  requireExtraAccess(grants,unit,role)
  const from=p.get('from'),to=p.get('to'),offset=Number(p.get('offset')||0)
  if(!from||!to||!validDate(from)||!validDate(to)||from>to||!Number.isInteger(offset)||offset<0||offset>100000)throw new ExtraError('Período ou página inválidos.')
  let q=db.schema('mise').from('extra_request_summary').select(REQUEST_SELECT).eq('unit_id',unit).order('data_trabalho',{ascending:false}).order('id').range(offset,offset+100)
  if(role==='lider'||!grants.some(g=>g.unit_id===unit&&g.role!=='lider'))q=q.eq('mise_requested_by',session.employeeId)
  if(p.get('queue')==='1') {
   if(role==='diretor')q=q.or('status.eq.aguardando_diretoria,and(emergencial.eq.true,mise_emergency_decision.is.null,status.not.in.(cancelado,recusado))')
   else if(role==='rh')q=q.in('status',['solicitado','aprovado_rh']).eq('rh_pendente',true)
   else q=q.not('status','in','(cancelado,recusado)').or('rh_pendente.eq.true,pagamentos_pendentes.gt.0,status.eq.aguardando_diretoria')
  } else q=q.gte('data_trabalho',from).lte('data_trabalho',to)
  const result=await q
  if(result.error)throw new ExtraError('Não foi possível carregar as posições.',503)
  // Pagination is kept on database rows; completed requests remain visible with their count.
  return Response.json({items:result.data.slice(0,100),hasMore:result.data.length>100},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){return extraResponseError(e)}
}
export async function POST(request:Request) {
 try {
  const {db,grants,session}=await extrasContext(),body=await request.json(),role=body.role as ExtraRole
  const unit=requireUuid(body.data?.unit_id)
  requireExtraAccess(grants,unit,role)
  if(!['lider','caixa'].includes(role))throw new ExtraError('Papel não pode solicitar.',403)
  requireUuid(body.data?.solicitante_cadastro_id);requireUuid(body.data?.cargo_id)
  if(!validDate(body.data?.data_trabalho??''))throw new ExtraError('Data inválida.')
  const result=await db.schema('mise').rpc('extra_request_command',{p_actor:session.employeeId,p_role:role,p_command:requireUuid(body.command_id),p_action:'solicitar',p_request:requireUuid(body.id),p_version:0,p_data:body.data})
  if(result.error)throw new ExtraError(result.error.code==='P0001'?result.error.message:'Confira os dados da solicitação.',409)
  after(async()=>{try{await dispatchExtraNotifications()}catch{console.error('Extras: notificação pendente.')}})
  return Response.json(result.data,{status:201})
 }catch(e){return extraResponseError(e)}
}
