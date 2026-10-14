import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {LeadRow} from './anticipation'
// Only request dates/flags. Never select CPF, payee names or receipts here.
export async function loadLeadRows(db:SupabaseClient,units:string[],from:string,to:string){
 const rows:LeadRow[]=[];if(!units.length)return rows
 for(const source of ['op_extra_solicitacao','op_extra'])for(let offset=0;;offset+=500){
  let query=db.from(source).select('id,unit_id,data_solicitacao,data_trabalho,emergencial').in('unit_id',units).gte('data_trabalho',from).lte('data_trabalho',to).not('status','in','(cancelado,recusado)').order('id').range(offset,offset+499)
  if(source==='op_extra')query=query.is('solicitacao_id',null)
  const result=await query;if(result.error)throw Error('Indicador de antecedência indisponível.');rows.push(...result.data);if(result.data.length<500)break
 }
 return rows
}
