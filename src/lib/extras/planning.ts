import type {ExtraJob} from './catalog'
export type PlanItem={id:string;data_trabalho:string;funcao:string;setor:string;quantidade:number;valor_unitario:number;valor_consumido:number;motivo:string;periodo:string|null;status:string;solicitante_nome:string;editable:boolean}
export type PlanSnapshot={revision:string;items:PlanItem[];schedule:{dia_semana:number;periodo:string}[];budget:{teto:number;usado:number;saldo:number;percentual:number|null;dias_sem_meta:number}}
export type PlanRow={key:string;period:string;job:ExtraJob;quantities:number[];rate:string;rateChanged:boolean;motive:string;original:PlanItem[][]}
export const moveWeek=(day:string,offset:number)=>{const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+offset*7);return d.toISOString().slice(0,10)}
export function planRows(jobs:ExtraJob[],items:PlanItem[],days:string[]):PlanRow[]{
 return [...new Set(items.map(i=>`${i.funcao}|${i.periodo??''}`))].map(key=>{
  const matches=items.filter(i=>`${i.funcao}|${i.periodo??''}`===key),name=matches[0].funcao,period=matches[0].periodo??'',job=jobs.find(j=>j.nome===name)??{id:'',nome:name,setor_padrao:matches[0].setor,valor_referencia:null,ordem:null}
  return {key,period,job,quantities:days.map(d=>matches.filter(i=>i.data_trabalho===d).reduce((s,i)=>s+i.quantidade,0)),rate:String(matches[0].valor_unitario),rateChanged:false,motive:'',original:days.map(d=>matches.filter(i=>i.data_trabalho===d))}
 }).sort((a,b)=>(a.job.ordem??9999)-(b.job.ordem??9999)||a.job.nome.localeCompare(b.job.nome))
}
export const cellLocked=(row:PlanRow,index:number)=>!row.job.id||!row.period||row.original[index].length>1||row.original[index].some(i=>!i.editable)
export const cellRate=(row:PlanRow,index:number)=>Number(row.rateChanged||!row.original[index].length?row.rate:row.original[index][0].valor_unitario)
export const cellCost=(row:PlanRow,index:number)=>cellLocked(row,index)?row.original[index].reduce((s,i)=>s+Math.round(Number(i.valor_consumido)*100),0):Math.round(cellRate(row,index)*100)*row.quantities[index]
export function planPayload(rows:PlanRow[],original:PlanRow[],days:string[],motive:string,motiveChanged:boolean){
 const all=[...rows,...original.filter(r=>!rows.some(x=>x.key===r.key)).map(r=>({...r,quantities:r.quantities.map(()=>0)}))]
 return all.flatMap(r=>days.flatMap((d,i)=>cellLocked(r,i)||(!r.quantities[i]&&!r.original[i].length)?[]:[{
  cargo_id:r.job.id,data_trabalho:d,quantidade:r.quantities[i],valor_unitario:cellRate(r,i)||null,
  motivo:r.motive||(motiveChanged?motive:r.original[i][0]?.motivo??motive),periodo:r.period,
 }]))
}
