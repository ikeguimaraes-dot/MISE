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

export async function GET(request:Request){
 try{
  const {db,grants,session}=await extrasContext(),params=new URL(request.url).searchParams
  const unit=requireUuid(params.get('unit_id')),week=params.get('week')??''
  requireExtraAccess(grants,unit,'lider');if(!validDate(week))throw new ExtraError('Semana inválida.')
  const result=await db.schema('mise').rpc('extra_grid_read',{p_actor:session.employeeId,p_unit:unit,p_week:week})
  if(result.error)throw new ExtraError('Não foi possível carregar a grade semanal.',503)
  return Response.json(result.data,{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){return extraResponseError(e)}
}
export async function PUT(request:Request){
 try{
  const {db,grants,session}=await extrasContext(),body=await request.json()
  const unit=requireUuid(body.unit_id);requireExtraAccess(grants,unit,'lider')
  requireUuid(body.command_id);requireUuid(body.requester_id)
  if(!validDate(body.week??'')||typeof body.revision!=='string'||!/^[a-f0-9]{32}$/.test(body.revision)||!Array.isArray(body.items)||body.items.length>700)throw new ExtraError('Grade inválida.')
  const days=weekDays(body.week)
  for(const row of body.items){requireUuid(row.cargo_id);if(!days.includes(row.data_trabalho)||!Number.isSafeInteger(row.quantidade)||row.quantidade<0)throw new ExtraError('Confira as datas e quantidades da semana.')}
  const result=await db.schema('mise').rpc('extra_grid_command',{p_actor:session.employeeId,p_command:body.command_id,p_unit:unit,p_week:body.week,p_revision:body.revision,p_requester:body.requester_id,p_items:body.items})
  if(result.error)throw new ExtraError(result.error.code==='P0001'?result.error.message:'Semana não enviada. Confira os dados e tente novamente.',409)
  after(async()=>{try{await dispatchExtraNotifications()}catch{console.error('Extras: notificação pendente.')}})
  return Response.json(result.data)
 }catch(e){return extraResponseError(e)}
}
