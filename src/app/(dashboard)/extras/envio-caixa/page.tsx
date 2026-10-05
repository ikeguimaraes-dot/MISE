import Link from 'next/link';
import { redirect } from 'next/navigation';
import { extrasContext, ExtraError, requireUuid } from '@/lib/extras/access';
import { validDate } from '@/lib/extras/alcada';
import { ExtraCashTable } from '@/components/extras-real/extra-cash-table';
import { BotaoExportar } from '@/app/(dashboard)/relatorio-diario/painel-geral/_components/botao-exportar';
import '@/components/extras-real/print.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{unit_id?:string;data?:string}>}) {
  const p=await searchParams;
  let ctx; try {ctx=await extrasContext();} catch(e) {if(e instanceof ExtraError&&e.status===401)redirect('/login');throw e;}
  const unit=requireUuid(p.unit_id), day=p.data ?? new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  if(!validDate(day)||!ctx.grants.some(g=>g.unit_id===unit&&['rh','financeiro','caixa'].includes(g.role))) return <p className="p-8">Sem acesso à lista do caixa.</p>;
  const [house, result]=await Promise.all([
    ctx.db.from('units').select('name').eq('id',unit).single(),
    ctx.db.from('op_extra').select('id,nome,solicitante_nome,setor,funcao,periodo,valor,total,status,pagadora,emergencial').eq('unit_id',unit).eq('data_trabalho',day).eq('mise_managed',true).not('status','in','(cancelado,recusado,aguardando_diretoria,solicitado)').order('setor').order('nome').limit(1000),
  ]);
  if(house.error||result.error)throw new Error('Lista do caixa indisponível.');
  if(result.data.length===1000)throw new Error('Lista extensa: refine o período.');
  const money=(n:number|null)=>n==null?'A definir':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return <section className="opx-print p-8 space-y-6"><nav className="print:hidden flex gap-6"><Link href={`/extras?unit_id=${unit}&data=${day}`}>← Extras</Link><BotaoExportar/></nav><header><p>MISE · RH → FINANCEIRO → CAIXA</p><h1 className="text-3xl">Envio Caixa · {house.data.name}</h1><p>{day.split('-').reverse().join('/')} · Emitido por {ctx.session.employeeName}</p></header><form className="print:hidden flex gap-3"><input type="hidden" name="unit_id" value={unit}/><label>Dia <input type="date" name="data" defaultValue={day} required/></label><button>Consultar</button></form><p>Pagamento liberado somente na etapa “Liberado para pagamento”. Esta lista não substitui o recibo assinado. O solicitante é um nome autodeclarado.</p><ExtraCashTable rows={result.data} unit={unit} day={day}/>{!result.data.length&&<p>Nenhum extra preparado pelo RH para este dia.</p>}<p>Total da lista: <strong>{money(result.data.reduce((s,e)=>s+Number(e.total??0),0))}</strong> · {result.data.length} registro(s)</p></section>;
}
