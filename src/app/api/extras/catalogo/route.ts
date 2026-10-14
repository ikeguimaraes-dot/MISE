import {extrasContext,requireExtraAccess,requireUuid,ExtraError,extraResponseError} from '@/lib/extras/access'
export async function GET(request:Request){
 try{
  const {db,grants}=await extrasContext();requireExtraAccess(grants,requireUuid(new URL(request.url).searchParams.get('unit_id')))
  const jobs=await db.from('op_extra_cargo').select('id,nome,setor_padrao,valor_referencia,ordem').eq('ativo',true).order('ordem',{nullsFirst:false}).order('nome')
  if(jobs.error)throw new ExtraError('Catálogo de funções indisponível.',503)
  return Response.json({items:jobs.data},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){return extraResponseError(e)}
}
