'use client'
import {useEffect,useRef,useState,type FormEvent} from 'react'
import {weekDays,type WeeklyBudget} from '@/lib/extras/alcada'
import {EXTRA_MOTIVES,jobSectors,type ExtraJob} from '@/lib/extras/catalog'
import {ExtraCurrencyInput} from './currency-input'
type Draft={id:string;day:string;job:string;quantity:number;rate:string;motive:string;period:string;context:string}
const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export function WeeklyPlan({unit,day,requesterId,requesterName,budget,onChanged}:{unit:string;day:string;requesterId:string;requesterName:string;budget:WeeklyBudget|null|undefined;onChanged:()=>void}){
 const [jobs,setJobs]=useState<ExtraJob[]>([]),[rows,setRows]=useState<Draft[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const pending=useRef<{signature:string;items:unknown[]}|null>(null),days=weekDays(day),sectors=jobSectors(jobs)
 useEffect(()=>{const c=new AbortController();fetch(`/api/extras/catalogo?unit_id=${unit}`,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setJobs(d.items)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[unit])
 const total=rows.reduce((sum,r)=>sum+Math.round(Number(r.rate)*100)*r.quantity,0),projected=(budget?.gasto??0)+total
 const pct=budget&&budget.teto>0?Math.round(projected/budget.teto*100):null
 const invalid=rows.some(r=>!r.job||!Number.isInteger(r.quantity)||r.quantity<1||!r.rate||Number(r.rate)<=0||!r.context.trim())
 function update(id:string,patch:Partial<Draft>){setRows(prev=>prev.map(r=>r.id===id?{...r,...patch}:r));setNotice('')}
 async function submit(e:FormEvent){e.preventDefault();if(invalid||!rows.length||!requesterId)return;setBusy(true);setError('');try{
  const data=rows.map(r=>({unit_id:unit,data_trabalho:r.day,cargo_id:r.job,quantidade:r.quantity,valor_unitario:Number(r.rate),motivo:r.motive,periodo:r.period,motivo_detalhe:r.context,solicitante_cadastro_id:requesterId,emergencial:false})),signature=JSON.stringify(data)
  if(pending.current?.signature!==signature)pending.current={signature,items:data.map(data=>({id:crypto.randomUUID(),command_id:crypto.randomUUID(),data}))}
  const response=await fetch('/api/extras/planejamento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unit_id:unit,week:days[0],items:pending.current.items})}),result=await response.json();if(!response.ok)throw Error(result.error)
  const approvals=result.items.filter((r:{status:string})=>r.status==='aguardando_diretoria').length
  setNotice(`Plano registrado: ${result.items.length} demanda(s). ${approvals?`${approvals} aguardando aprovação da diretoria.`:'Demandas enviadas ao RH.'}`);setRows([]);pending.current=null;onChanged()
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="er-panel er-week-plan"><h2>Planejar a semana</h2><p>Antecipe as posições de segunda a domingo. Confira o custo completo antes de enviar.</p><p>Solicitante: <strong>{requesterName||'Selecione seu nome no cabeçalho'}</strong> · identificação declarada.</p>
 {error&&<p role="alert" className="er-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <form onSubmit={submit}><fieldset disabled={busy} className="er-plan-fieldset"><div className="er-week-grid">{days.map(date=><section key={date} className="er-plan-day"><h3>{new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',timeZone:'UTC'})}</h3>
 {rows.filter(r=>r.day===date).map((r,i)=><fieldset className="er-plan-demand" key={r.id}><legend>Demanda {i+1}</legend>
 <label>Função<select aria-label={`Função ${date} ${i+1}`} required value={r.job} onChange={e=>update(r.id,{job:e.target.value,rate:String(jobs.find(j=>j.id===e.target.value)?.valor_referencia??'')})}><option value="">Selecione</option>{sectors.map(s=><optgroup key={s} label={s}>{jobs.filter(j=>j.setor_padrao===s).map(j=><option key={j.id} value={j.id}>{j.nome}</option>)}</optgroup>)}</select></label>{r.job&&<small>Setor: {jobs.find(j=>j.id===r.job)?.setor_padrao}</small>}
 <div className="er-plan-pair"><label>Quantidade<input aria-label={`Quantidade ${date} ${i+1}`} type="number" min={1} required value={r.quantity||''} onChange={e=>update(r.id,{quantity:Number(e.target.value)})}/></label><label>Diária<ExtraCurrencyInput label={`Diária ${date} ${i+1}`} value={r.rate} onChange={rate=>update(r.id,{rate})}/></label></div>
 {r.rate!==''&&<p>Estimado: <strong>{brl(r.quantity*Number(r.rate))}</strong></p>}
 <label>Motivo<select value={r.motive} onChange={e=>update(r.id,{motive:e.target.value})}>{EXTRA_MOTIVES.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
 <label>Período<select value={r.period} onChange={e=>update(r.id,{period:e.target.value})}><option value="almoco">Almoço</option><option value="jantar">Jantar</option><option value="manha">Manhã</option><option value="eventos">Eventos</option></select></label>
 <label>Contexto<textarea required value={r.context} maxLength={2000} onChange={e=>update(r.id,{context:e.target.value})}/></label><button type="button" onClick={()=>setRows(prev=>prev.filter(x=>x.id!==r.id))}>Retirar do rascunho</button>
 </fieldset>)}
 <button type="button" disabled={!jobs.length||rows.length>=70} onClick={()=>setRows(prev=>[...prev,{id:crypto.randomUUID(),day:date,job:'',quantity:1,rate:'',motive:'evento',period:'almoco',context:''}])}>+ Adicionar demanda</button></section>)}</div>
 <div className="er-plan-summary" aria-live="polite"><h3>Antes de enviar</h3><p>Novas demandas: <strong>{brl(total/100)}</strong>{invalid?' · há campos a completar.':''}</p>{budget?<><p>Com o que já foi registrado, este plano consome <strong>{brl(projected/100)}</strong> dos <strong>{brl(budget.teto/100)}</strong> da semana{pct!==null?` — ${pct}%`:''}.</p>{projected>budget.teto&&<p>Excede a alçada em {brl((projected-budget.teto)/100)}. As demandas que ultrapassarem o saldo seguirão para aprovação da diretoria.</p>}</>:<p>Alçada indisponível para prévia. O servidor verifica o saldo no envio.</p>}<p>A estimativa será conferida novamente no envio para considerar outras solicitações da casa.</p>
 <button className="er-primary" disabled={busy||invalid||!rows.length||!requesterId}>{busy?'Registrando plano…':'Registrar plano da semana'}</button></div>
 </fieldset></form></section>
}
