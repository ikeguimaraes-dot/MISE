import { after } from 'next/server'
import { extrasContext, requireExtraAccess, requireUuid, ExtraError, extraResponseError, type ExtraRole } from '@/lib/extras/access'
import { dispatchExtraNotifications } from '@/lib/extras/notifications'
export const maxDuration=60
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {db,grants,session}=await extrasContext(),{id}=await params;requireUuid(id)
  const body=await request.json(),role=body.role as ExtraRole
  if(!['nomear_rh','aprovar','cancelar','recusar','ratificar_emergencia','nao_ratificar_emergencia'].includes(body.action)||!Number.isInteger(body.version))throw new ExtraError('Comando inválido.')
  const item=await db.from('op_extra_solicitacao').select('unit_id').eq('id',id).single()
  if(item.error||!item.data)throw new ExtraError('Solicitação não encontrada.',404)
  requireExtraAccess(grants,item.data.unit_id,role)
  const result=await db.schema('mise').rpc('extra_request_command',{p_actor:session.employeeId,p_role:role,p_command:requireUuid(body.command_id),p_action:body.action,p_request:id,p_version:body.version,p_data:body.data??{}})
  if(result.error)throw new ExtraError(result.error.code==='P0001'?result.error.message:'Etapa não concluída. Recarregue a solicitação.',409)
  after(async()=>{try{await dispatchExtraNotifications()}catch{console.error('Extras: notificação pendente.')}})
  return Response.json(result.data)
 }catch(e){return extraResponseError(e)}
}
