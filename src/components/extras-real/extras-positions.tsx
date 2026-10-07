'use client'
import {useEffect,useRef,useState,type FormEvent} from 'react'
import {useDetailNavigation} from './use-detail-navigation'
import {ExtraCurrencyInput} from './currency-input'
import {EXTRA_MOTIVES,jobSectors,type ExtraJob} from '@/lib/extras/catalog'
import {Inbox,MousePointer2} from 'lucide-react'
import {positionActions,positionStatus,type PositionRequest} from '@/lib/extras/positions'
import {ACTION_LABELS,ROLE_LABELS,STATUS_LABELS,validCpf,type OperationalRole,type RealExtra} from '@/lib/extras/workflow'
import {useWeeklyBudget} from '@/components/extras-evaluation/weekly-budget'
import {weekDays} from '@/lib/extras/alcada'
const money=(n:number)=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
async function api(url:string,options?:RequestInit){const r=await fetch(url,{cache:'no-store',...options});const d=await r.json();if(!r.ok)throw new Error(d.error||'Não foi possível concluir.');return d}
type Job=ExtraJob
type Detail={item:PositionRequest;people:(RealExtra&{cpf?:string})[];events:{id:string;actor_role:OperationalRole;action:string;note:string|null;created_at:string}[]}
export function ExtraPositions({unit,day,role,employeeId,queue,creating,onClose,onChanged,onPerson,initialRequest,requesterId,requesterName}:{unit:{id:string;name:string};day:string;role:OperationalRole;employeeId:string;queue:boolean;creating:boolean;onClose:()=>void;onChanged:(workDay?:string)=>void;onPerson:(id:string)=>void;initialRequest?:string;requesterId?:string;requesterName?:string}){
 const [items,setItems]=useState<PositionRequest[]>([]),[detail,setDetail]=useState<Detail|null>(null),[selected,setSelected]=useState(initialRequest||''),[revision,setRevision]=useState(0)
 const {detailRef,listRef,returnToList}=useDetailNavigation(selected,!!detail)
 const [query,setQuery]=useState('')
 const createRef=useRef<HTMLElement>(null)
 useEffect(()=>{if(creating){createRef.current?.focus({preventScroll:true});createRef.current?.scrollIntoView({block:'start',behavior:'instant'})}},[creating])
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[hasMore,setHasMore]=useState(false),[action,setAction]=useState('')
 const [jobs,setJobs]=useState<Job[]>([]),[requesters,setRequesters]=useState<{id:string;nome:string}[]>([]),[catalogLoading,setCatalogLoading]=useState(false)
 const [job,setJob]=useState(''),[quantity,setQuantity]=useState(1),[rate,setRate]=useState(''),[requestDay,setRequestDay]=useState(day),[urgent,setUrgent]=useState(role==='caixa')
 const [notice,setNotice]=useState('')
 const pending=useRef<{signature:string;id:string;command:string}|null>(null)
 const dates=weekDays(day),url=`/api/extras/solicitacoes?unit_id=${unit.id}&role=${role}&from=${dates[0]}&to=${dates[6]}&queue=${queue?1:0}`
 const budgetState=useWeeklyBudget(unit,requestDay,'review'),budget=budgetState.budget
 const estimate=Math.round(quantity*Number(rate)*100)/100
 useEffect(()=>{const c=new AbortController();setLoading(true);setItems([]);api(url,{signal:c.signal}).then(d=>{setItems(d.items);setHasMore(d.hasMore)}).catch(e=>{if(!c.signal.aborted)setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort()},[url,revision])
 useEffect(()=>{const c=new AbortController();setDetail(null);setAction('');if(selected)api(`/api/extras/solicitacoes/${selected}`,{signal:c.signal}).then(setDetail).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[selected,revision])
 useEffect(()=>{if(!creating)return;const c=new AbortController();setJob('');setQuantity(1);setRate('');setRequestDay(day);setUrgent(role==='caixa');setCatalogLoading(true);setError('');Promise.all([api(`/api/extras/catalogo?unit_id=${unit.id}`,{signal:c.signal}),api(`/api/extras/solicitantes?unit_id=${unit.id}`,{signal:c.signal})]).then(([j,r])=>{setJobs(j.items);setRequesters(r.items)}).catch(e=>{if(!c.signal.aborted)setError(e.message)}).finally(()=>{if(!c.signal.aborted)setCatalogLoading(false)});return()=>c.abort()},[creating,unit.id,day,role,revision])
 function refresh(workDay?:string){setRevision(v=>v+1);budgetState.retry();onChanged(workDay)}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');setBusy(true)
  try{
   const f=new FormData(event.currentTarget);let endpoint='/api/extras/solicitacoes',data:Record<string,unknown>,body:Record<string,unknown>
   if(creating){data={unit_id:unit.id,data_trabalho:requestDay,periodo:f.get('periodo'),cargo_id:job,quantidade:quantity,valor_unitario:Number(rate),solicitante_cadastro_id:role==='lider'?requesterId:f.get('solicitante'),motivo:f.get('motivo'),motivo_detalhe:urgent?(String(f.get('contexto')||'').trim()||null):null,emergencial:urgent};body={role,data}}
   else{
    if(!detail)throw new Error('Selecione uma solicitação.')
    data={note:f.get('note')};endpoint+=`/${detail.item.id}/actions`
    if(['nomear_rh','nomear_emergencia'].includes(action)){
     const pessoas=[]
     for(let pos=1;pos<=detail.item.quantidade;pos++){
      if(detail.people.some(p=>p.mise_position===pos))continue
      const nome=String(f.get(`nome-${pos}`)||'').trim(),cpf=String(f.get(`cpf-${pos}`)||'').replace(/\D/g,''),valor=Number(f.get(`valor-${pos}`))
      if(!nome&&!cpf)continue
      if(!nome||(action==='nomear_rh'? !validCpf(cpf):!!cpf&&!validCpf(cpf)))throw new Error(`Posição ${pos}: preencha nome e CPF válido.`)
      if(!Number.isFinite(valor)||valor<=0)throw new Error(`Posição ${pos}: informe uma diária positiva.`)
      pessoas.push({posicao:pos,nome,cpf,valor})
     }
     if(!pessoas.length)throw new Error('Preencha ao menos uma nova posição. As demais podem ficar em branco.')
     data={...data,pessoas,pagadora:f.get('pagadora')}
    }
    body={role,action,version:detail.item.mise_version,data}
   }
   const signature=JSON.stringify({endpoint,body});if(pending.current?.signature!==signature)pending.current={signature,id:crypto.randomUUID(),command:crypto.randomUUID()}
   const r=await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,command_id:pending.current.command,...(creating?{id:pending.current.id}:{})})})
   pending.current=null;setSelected(r.id);onClose();setAction('');setNotice(r.status==='aguardando_diretoria'?'Registrado. Aguardando aprovação do Diretor de Operação.':action==='nomear_rh'?'Pessoas nomeadas. Cada pagamento segue individualmente.':'Solicitação registrada.');refresh(creating?requestDay:undefined)
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const item=detail?.item,actions=item?positionActions(item,role,employeeId):[]
 const sectors=jobSectors(jobs)
 return <>
  {error&&<p className="er-error" role="alert">{error} <button type="button" onClick={()=>{setError('');refresh()}}>Recarregar</button></p>}
  {notice&&<p className="er-field-help" role="status">{notice}</p>}
  {creating?<section ref={createRef} tabIndex={-1} className="er-panel er-create" aria-label="Nova solicitação de posições"><h2>Solicitar posições</h2><p>Informe a necessidade da casa. O RH identifica as pessoas que vão trabalhar.</p>
   <form className="er-form" onSubmit={submit}>
    <label className="er-wide er-check"><input type="checkbox" checked={urgent} disabled={role==='caixa'} onChange={e=>setUrgent(e.target.checked)}/>Emergencial · alerta imediato à diretoria</label>
    {urgent&&<label className="er-wide">Contexto emergencial <small>(opcional)</small><textarea name="contexto" aria-label="Contexto emergencial" maxLength={2000}/></label>}
    <label className="er-wide">Função<select aria-label="Função" required value={job} disabled={catalogLoading||busy} onChange={e=>{setJob(e.target.value);setRate(String(jobs.find(j=>j.id===e.target.value)?.valor_referencia??''))}}><option value="">Selecione a função</option>{sectors.map(sector=><optgroup key={sector} label={sector}>{jobs.filter(j=>j.setor_padrao===sector).map(j=><option key={j.id} value={j.id}>{j.nome}</option>)}</optgroup>)}</select>{job&&<small>Setor: {jobs.find(j=>j.id===job)?.setor_padrao}</small>}</label>
    <label>Quantidade<input type="number" min="1" step="1" required value={quantity||''} onChange={e=>setQuantity(Number(e.target.value))}/></label>
    <label>Valor da diária (R$)<ExtraCurrencyInput label="Valor da diária (R$)" value={rate} onChange={setRate} disabled={busy}/></label>
    {rate!==''&&<p className="er-wide er-estimate" aria-live="polite">Estimado: <strong>{money(Number.isFinite(estimate)?estimate:0)}</strong> · {quantity||0} posições × {money(Number(rate)||0)}</p>}
    <label>Motivo<select aria-label="Motivo" name="motivo" required>{EXTRA_MOTIVES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Data do trabalho<input type="date" required value={requestDay} onChange={e=>{if(e.target.value)setRequestDay(e.target.value)}}/></label>
    <label>Período<select aria-label="Período" name="periodo" required><option value="almoco">Almoço</option><option value="jantar">Jantar</option><option value="manha">Manhã</option><option value="eventos">Eventos</option></select></label>
    {role==='lider'?<p className="er-wide">Solicitante: <strong>{requesterName||'Selecione seu nome no cabeçalho'}</strong></p>:<label>Solicitante<select aria-label="Solicitante" name="solicitante" required disabled={catalogLoading||busy} defaultValue=""><option value="">Selecione quem está solicitando</option>{requesters.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>}
    <p className="er-wide er-field-help">Solicitante autodeclarado. Não substitui a identificação por login individual.</p>
    {!catalogLoading&&!requesters.length&&<p className="er-wide">Nenhum solicitante ativo nesta casa. Peça o cadastro à administração.</p>}
    {!catalogLoading&&!jobs.length&&<p className="er-wide">Nenhuma função ativa disponível. Peça a revisão do catálogo à administração.</p>}
    {budget&&estimate*100>budget.saldo&&<p className="er-wide" role="status">Esta solicitação excede a alçada da semana em {money(estimate-budget.saldo/100)}. {urgent?'A exceção ficará registrada e a diretoria será alertada.':'Será enviada para aprovação do Diretor de Operação.'}</p>}
    {!budget&&<p className="er-wide">{budgetState.error||'Consultando alçada…'} O valor será verificado no envio.</p>}
    <div className="er-wide er-buttons"><button disabled={busy||catalogLoading||!requesters.length||!job||(role==='lider'&&!requesterId)||Number(rate)<=0}>{busy?'Registrando…':'Registrar solicitação'}</button><button type="button" disabled={busy} onClick={()=>returnToList(()=>{setSelected('');onClose()})}>Voltar</button></div>
   </form>
  </section>:<div className="er-grid" data-detail-open={!!selected}>
   <section ref={listRef} tabIndex={-1} className="er-panel er-list" aria-label="Lista de pedidos"><div className="er-list-heading"><h2>Pedidos de posições</h2><span className="er-count">{loading?'Carregando…':`${items.length} solicitações`}</span></div>
    <label className="er-list-search">Buscar nesta lista<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Função, solicitante ou setor"/></label>
    {!loading&&!items.length&&<div className="er-empty"><span className="er-empty-icon"><Inbox size={22}/></span><h3>Nenhum pedido nesta visualização</h3><p>Os pedidos da casa e as posições a preencher aparecerão aqui.</p></div>}
    {!loading&&!!items.length&&!items.some(s=>`${s.funcao} ${s.setor} ${s.solicitante_nome}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")))&&<p className="er-search-empty" role="status">Nenhum pedido encontrado nesta lista.</p>}
    {items.filter(s=>`${s.funcao} ${s.setor} ${s.solicitante_nome}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))).map(s=><button key={s.id} disabled={busy} className={`er-request ${selected===s.id?'selected':''}`} aria-pressed={selected===s.id} onClick={()=>setSelected(s.id)}><small>{positionStatus(s)}{s.emergencial?' · Emergencial':''}</small><strong>{s.quantidade} × {s.funcao}</strong><span>{s.setor} · {s.data_trabalho.split('-').reverse().join('/')}</span><span>{s.preenchidos} de {s.quantidade} preenchidos</span><span className="er-requester">Solicitante: {s.solicitante_nome}</span><b>{money(s.valor_consumido)}</b></button>)}
    {hasMore&&<button disabled={busy} onClick={async()=>{setBusy(true);try{const d=await api(`${url}&offset=${items.length}`);setItems(prev=>[...prev,...d.items]);setHasMore(d.hasMore)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Carregar mais</button>}
   </section>
   <section ref={detailRef} tabIndex={-1} className={`er-panel er-detail ${!item?'er-detail-empty':''}`} aria-label="Detalhes do pedido de posições">
    <button type="button" className="er-mobile-back" onClick={()=>returnToList(()=>{setSelected('');setAction('');})}>← Voltar aos pedidos</button>
    {item&&detail?<><p className="er-eyebrow">{positionStatus(item)}</p><h2>{item.quantidade} posições · {item.funcao}</h2><p>{item.setor} · {item.data_trabalho.split('-').reverse().join('/')} · {item.periodo}</p>
     <div className="er-declared-requester"><span>Solicitante</span><strong>{item.solicitante_nome}</strong><small>Nome autodeclarado</small></div>{item.motivo_detalhe&&<blockquote>{item.motivo_detalhe}</blockquote>}
     <div className="er-values"><span>Pedido original<b>{money(item.valor_total)}</b></span><span>Consumo da alçada<b>{money(item.valor_consumido)}</b></span></div>
     <p className="er-fill-count">{item.preenchidos} de {item.quantidade} preenchidos</p><p className="er-field-help">{item.mise_named_at?'O consumo considera as pessoas nomeadas. Novas nomeações recalculam a alçada.':'O pedido reserva a estimativa completa até o RH nomear as pessoas.'}</p>
     {item.emergencial&&<p>Diretoria: {item.mise_emergency_decision==='aprovado'?'emergência aprovada':item.mise_emergency_decision==='nao_ratificado'?'emergência não aprovada; pagamentos preservados':'revisão da emergência pendente'}.</p>}
     {detail.people.length>0&&<div className="er-named-people">{detail.people.map(p=><button type="button" key={p.id} className="er-person-link" onClick={()=>onPerson(p.id)}><span>{p.nome}<small>{STATUS_LABELS[p.status]||p.status}</small></span><strong>{money(p.valor??0)}</strong></button>)}</div>}
     {!action?<div className="er-buttons">{actions.map(a=><button key={a} className={["nomear_rh","aprovar","ratificar_emergencia"].includes(a)?"er-primary":""} disabled={busy} onClick={()=>setAction(a)}>{ACTION_LABELS[a]}</button>)}{!actions.length&&<p>Nenhuma ação para {ROLE_LABELS[role]} nesta etapa. Financeiro e Caixa acompanham cada pessoa em “Pessoas / pagamentos”.</p>}</div>:<form className="er-form" key={`${item.id}-${item.mise_version}-${action}`} onSubmit={submit}>
      <h3 className="er-wide">{ACTION_LABELS[action]}</h3>
      {['nomear_rh','nomear_emergencia'].includes(action)&&<><p className="er-wide er-field-help">Preencha quem já está definido e deixe nome e CPF em branco nas demais posições. Cada pessoa terá seu pagamento e recibo.</p><label className="er-wide">Pagadora<select aria-label="Pagadora" name="pagadora" defaultValue={item.pagadora||'casa'}>{(action==='nomear_emergencia'?['casa']:detail.people.length?[item.pagadora]:['casa','terceirizada']).map(p=><option key={p} value={p}>{p==='casa'?'Casa':'Estaff / terceirizada'}</option>)}</select></label>
       {Array.from({length:item.quantidade},(_,i)=>i+1).map(pos=>{const person=detail.people.find(p=>p.mise_position===pos);return <fieldset key={pos} className="er-wide er-position-block"><legend>Posição {pos}{person?' · preenchida':''}</legend>{person?<p>{person.nome} · {money(person.valor??0)} · {STATUS_LABELS[person.status]}</p>:<div className="er-form"><label>Nome<input name={`nome-${pos}`} maxLength={200}/></label><label>CPF<input name={`cpf-${pos}`} inputMode="numeric" maxLength={14}/></label><label>Diária (R$)<input name={`valor-${pos}`} type="number" min="0.01" step="0.01" defaultValue={item.valor_unitario}/></label></div>}</fieldset>})}
      </>}
      <label className="er-wide">{['nomear_rh','nomear_emergencia'].includes(action)?'Observação':'Justificativa obrigatória'}<textarea name="note" required={!['nomear_rh','nomear_emergencia'].includes(action)} maxLength={2000}/></label><div className="er-wide er-buttons"><button disabled={busy}>{busy?'Salvando…':['nomear_rh','nomear_emergencia'].includes(action)?'Salvar pessoas preenchidas':'Confirmar'}</button><button type="button" disabled={busy} onClick={()=>setAction('')}>Voltar</button></div>
     </form>}
     <details className="er-history-details"><summary>Histórico da solicitação</summary><ol className="er-history">{detail.events.map(e=><li key={e.id}><strong>{ACTION_LABELS[e.action]||'Pedido registrado'}</strong><p>{ROLE_LABELS[e.actor_role]} · {new Date(e.created_at).toLocaleString('pt-BR')}</p>{e.note&&<p>{e.note}</p>}</li>)}</ol></details>
    </>:<div className="er-empty"><span className="er-empty-icon"><MousePointer2 size={22}/></span><h3>{selected?'Carregando detalhes…':'Da necessidade às pessoas'}</h3><p>Selecione um pedido para acompanhar o preenchimento das posições.</p></div>}
   </section>
  </div>}
 </>
}
