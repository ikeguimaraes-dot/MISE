import {extrasContext,requireExtraAccess,requireUuid,ExtraError,extraResponseError} from '@/lib/extras/access'
export async function GET(request:Request){
 try{
  const {db,grants}=await extrasContext();requireExtraAccess(grants,requireUuid(new URL(request.url).searchParams.get('unit_id')))
  const [jobs,sectors]=await Promise.all([db.from('op_extra_cargo').select('id,nome,valor_referencia').eq('ativo',true).order('nome'),db.from('op_extra_cargo_setor').select('cargo_id,setor').order('setor')])
  if(jobs.error||sectors.error)throw new ExtraError('Catálogo de funções indisponível.',503)
  return Response.json({items:jobs.data.map(j=>({...j,setores:sectors.data.filter(s=>s.cargo_id===j.id).map(s=>s.setor)}))},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){return extraResponseError(e)}
}
