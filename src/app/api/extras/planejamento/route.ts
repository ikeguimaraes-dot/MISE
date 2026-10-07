import {after} from 'next/server'
import {extrasContext,requireExtraAccess,requireUuid,ExtraError,extraResponseError} from '@/lib/extras/access'
import {validDate,weekDays} from '@/lib/extras/alcada'
import {dispatchExtraNotifications} from '@/lib/extras/notifications'
export const maxDuration=60
export async function POST(request:Request){
 try{
  const {db,grants,session}=await extrasContext(),body=await request.json()
  const unit=requireUuid(body.unit_id);requireExtraAccess(grants,unit,'lider')
  if(!validDate(body.week??'')||!Array.isArray(body.items)||body.items.length<1||body.items.length>70)throw new ExtraError('Plano inválido.')
  const days=weekDays(body.week)
  for(const row of body.items){requireUuid(row.id);requireUuid(row.command_id);requireUuid(row.data?.cargo_id);requireUuid(row.data?.solicitante_cadastro_id);if(row.data?.unit_id!==unit||!days.includes(row.data?.data_trabalho)||row.data?.emergencial)throw new ExtraError('Confira casa, semana e demandas do plano.')}
  const result=await db.schema('mise').rpc('extra_plan_command',{p_actor:session.employeeId,p_role:'lider',p_unit:unit,p_week:body.week,p_items:body.items})
  if(result.error)throw new ExtraError(result.error.code==='P0001'?result.error.message:'Plano não registrado. Confira os dados e tente novamente.',409)
  after(async()=>{try{await dispatchExtraNotifications()}catch{console.error('Extras: notificação pendente.')}})
  return Response.json(result.data,{status:201})
 }catch(e){return extraResponseError(e)}
}
