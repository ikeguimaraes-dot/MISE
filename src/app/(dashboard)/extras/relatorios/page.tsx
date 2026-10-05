import Link from 'next/link';
import {redirect} from 'next/navigation';
import {extrasContext,ExtraError,requireExtraAccess} from '@/lib/extras/access';
import '@/components/extras-real/print.css';
export const dynamic='force-dynamic';
type Cost={mes:number;setor:string;custo:number|null;quantidade:number;sem_valor:number};
type RequesterCost={mes:number;solicitante_nome:string|null;quantidade:number;custo:number|null;sem_valor:number};
type Revenue={mes:number;faturamento:number|null;fonte:string};
export default async function Page({searchParams}:{searchParams:Promise<{unit_id?:string;ano?:string}>}) {
 let ctx;try{ctx=await extrasContext();}catch(e){if(e instanceof ExtraError&&e.status===401)redirect('/login');throw e;}
 const p=await searchParams, year=Number(p.ano||new Date().getFullYear());
 if(!Number.isInteger(year)||year<2022||year>2100)return <p>Ano inválido.</p>;
 const ids=[...new Set(ctx.grants.map(g=>g.unit_id))];
 if(!ids.length)return <p className="p-8">Sem unidades disponíveis.</p>;
 const unit=p.unit_id||ids[0];requireExtraAccess(ctx.grants,unit);
 const [units,result]=await Promise.all([ctx.db.from('units').select('id,name').in('id',ids).eq('active',true).order('name'),ctx.db.schema('mise').rpc('extra_monthly_report',{p_unit:unit,p_year:year})]);
 if(units.error||result.error)throw new Error('Relatório indisponível.');
 const costs=result.data.custos as Cost[], revenues=result.data.receitas as Revenue[];
 const requesters=(result.data.solicitantes ?? []) as RequesterCost[];
 const sectors=[...new Set(costs.map(c=>c.setor))].sort(), peak=Math.max(1,...costs.map(c=>Number(c.custo||0)));
 const brl=(n:number|null)=>n==null?'A definir':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 return <section className="opx-print p-8 space-y-6"><Link href={`/extras?unit_id=${unit}`}>← Extras</Link><h1 className="text-3xl">Onde os extras pesam na operação</h1><p>Custo por mês e setor · inclui solicitações em andamento; exclui canceladas e recusadas.</p><form className="flex flex-wrap gap-4"><label>Casa <select name="unit_id" defaultValue={unit}>{units.data.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Ano <input type="number" name="ano" defaultValue={year} min={2022} max={2100}/></label><button>Consultar</button></form><p>A intensidade do laranja representa o custo. Cada percentual compara o setor com o faturamento realizado da casa naquele mês. Sem faturamento confirmado na DRE, o percentual fica em branco.</p><div className="overflow-x-auto"><table><thead><tr><th>Mês</th>{sectors.map(s=><th key={s}>{s}</th>)}<th>Total extras</th><th>Faturamento da casa</th><th>% da receita</th></tr></thead><tbody>{Array.from({length:12},(_,i)=>i+1).map(m=>{
 const rows=costs.filter(c=>c.mes===m), total=rows.reduce((s,c)=>s+Number(c.custo??0),0), unknown=rows.reduce((s,c)=>s+c.sem_valor,0), rev=revenues.find(r=>r.mes===m), fat=rev?.faturamento;
 return <tr key={m}><th>{new Date(Date.UTC(year,m-1,15)).toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'})}</th>{sectors.map(s=>{const c=rows.find(c=>c.setor===s);return <td key={s} style={{background:c?`rgba(255,110,65,${.08+.45*Number(c.custo??0)/peak})`:undefined}}>{c?<>{brl(c.custo)}<br/><small>{c.sem_valor?`${c.sem_valor} sem valor`:(fat&&fat>0?`${(Number(c.custo??0)/fat*100).toFixed(2)}%`:'—')}</small></>:'—'}</td>})}<td>{brl(total)}{unknown>0&&<small> + {unknown} a definir</small>}</td><td title={rev?.fonte}>{fat==null?'Não informado':brl(fat)}</td><td>{!unknown&&fat&&fat>0?`${(total/fat*100).toFixed(2)}%`:'—'}</td></tr>})}</tbody></table></div>{!costs.length&&<p>Nenhum extra registrado neste ano. O histórico anterior continua aguardando autorização de importação.</p>}
 <section className="space-y-3"><h2>Extras por solicitante</h2><p>Nomes declarados no momento de cada pedido. Renomear ou desativar o cadastro não altera este histórico. Esta informação não comprova a identidade de quem usou o login.</p>
 <div className="overflow-x-auto"><table><thead><tr><th>Mês</th><th>Solicitante</th><th>Solicitações</th><th>Custo de extras</th></tr></thead><tbody>{requesters.map((r,i)=><tr key={i}><td>{new Date(Date.UTC(year,r.mes-1,15)).toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'})}</td><td>{r.solicitante_nome || 'Não informado no registro'}</td><td>{r.quantidade}</td><td>{brl(r.custo)}{r.sem_valor>0&&<small> · {r.sem_valor} a definir</small>}</td></tr>)}</tbody></table></div>{!requesters.length&&<p>Nenhum lançamento para agrupar por solicitante.</p>}</section></section>;
}
