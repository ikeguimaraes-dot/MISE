import {extrasContext,requireExtraAccess,requireUuid,ExtraError,extraResponseError} from '@/lib/extras/access';
import {validDate} from '@/lib/extras/alcada';
import {loadWeeklyBudget} from '@/lib/extras/alcada-server';
export async function GET(request:Request){
 try {
  const {db,grants}=await extrasContext(),p=new URL(request.url).searchParams;
  const unit=requireUuid(p.get('unit_id')),day=p.get('data')??'';
  if(!validDate(day))throw new ExtraError('Data inválida.');
  requireExtraAccess(grants,unit);
  const active=await db.from('units').select('id').eq('id',unit).eq('active',true).maybeSingle();
  if(active.error||!active.data)throw new ExtraError('Unidade operacional indisponível.',404);
  return Response.json(await loadWeeklyBudget(db,unit,day),{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return extraResponseError(e)}
}
