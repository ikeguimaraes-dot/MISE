import Link from 'next/link';
import {redirect} from 'next/navigation';
import {crivoContext,CrivoError} from '@/lib/crivo/access';
import '@/components/extras-real/print.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{status?:string;local?:string;vencidas?:string;pagina?:string}>}){
 let ctx;try{ctx=await crivoContext()}catch(e){if(e instanceof CrivoError&&e.status===401)redirect('/login');throw e;}
 if(ctx.session.role==='cozinheiro')redirect('/');
 const p=await searchParams, page=Math.max(0,Math.min(1000,Number(p.pagina)||0)), today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 let localsQuery=ctx.db.schema('mise').from('crivo_locais').select('id,nome,unit_id').order('nome');
 if(ctx.session.role!=='admin')localsQuery=localsQuery.eq('unit_id',ctx.unitId);
 const locals=await localsQuery;if(locals.error)throw new Error('Locais indisponíveis.');
 let query=ctx.db.schema('mise').from('crivo_plano_acao').select('id,execution_id,descricao,orientacao,responsavel_nome,prazo,status,revisao_pendente,execution:checklist_executions!inner(unit_id,local_id,plano_revisado_em)').order('prazo',{nullsFirst:true}).order('id').range(page*100,page*100+100);
 if(ctx.session.role!=='admin')query=query.eq('execution.unit_id',ctx.unitId).not('execution.plano_revisado_em','is',null).eq('revisao_pendente',false);
 if(p.local&&locals.data.some(l=>l.id===p.local))query=query.eq('execution.local_id',p.local);
 if(p.status==='revisao')query=query.eq('revisao_pendente',true);
 else if(['aberto','em_andamento','resolvido','cancelado'].includes(p.status||''))query=query.eq('status',p.status!);
 else query=query.not('status','in','(resolvido,cancelado)');
 if(p.vencidas==='1')query=query.lt('prazo',today).not('status','in','(resolvido,cancelado)');
 const result=await query;if(result.error)throw new Error('Plano de ação indisponível.');
 const params=new URLSearchParams(Object.entries(p).filter(([,v])=>v!==undefined) as [string,string][]);
 const pageLink=(n:number)=>{const q=new URLSearchParams(params);q.set('pagina',String(n));return `?${q}`};
 return <main className="opx-print p-8 space-y-6"><Link href="/crivo">← CRIVO</Link><h1 className="text-3xl">Plano de ação</h1><p>O que precisa ser corrigido, por quem e até quando.</p><form className="flex flex-wrap gap-4"><label>Local <select name="local" defaultValue={p.local||''}><option value="">Todos os locais permitidos</option>{locals.data.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><label>Status <select name="status" defaultValue={p.status||''}><option value="">Pendências abertas</option>{['aberto','em_andamento','resolvido','cancelado',...(ctx.session.role==='admin'?['revisao']:[])].map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label><label><input type="checkbox" name="vencidas" value="1" defaultChecked={p.vencidas==='1'}/> Somente vencidas</label><button>Filtrar</button></form><div className="overflow-x-auto"><table><thead><tr><th>Local / ação</th><th>Responsável</th><th>Prazo</th><th>Status</th><th/></tr></thead><tbody>{result.data.slice(0,100).map(a=>{const execution=Array.isArray(a.execution)?a.execution[0]:a.execution;const overdue=a.prazo&&a.prazo<today&&!['resolvido','cancelado'].includes(a.status);return <tr key={a.id} style={overdue?{background:'rgba(255,110,65,.14)'}:undefined}><td><b>{locals.data.find(l=>l.id===execution?.local_id)?.nome||'Local não informado'}</b><br/>{a.descricao}<p>{a.orientacao}</p></td><td>{a.responsavel_nome||'A definir pelo auditor'}</td><td>{a.prazo?.split('-').reverse().join('/')||'A definir'}{overdue&&<strong> · VENCIDA</strong>}</td><td>{a.revisao_pendente?'Revisão pendente':a.status.replaceAll('_',' ')}</td><td><Link href={`/crivo/relatorios/${a.execution_id}`}>Abrir plano →</Link></td></tr>})}</tbody></table></div>{!result.data.length&&<p>Nenhuma ação para estes filtros.</p>}<nav className="flex gap-5">{page>0&&<Link href={pageLink(page-1)}>← Anterior</Link>}{result.data.length>100&&<Link href={pageLink(page+1)}>Próxima →</Link>}</nav></main>;
}
