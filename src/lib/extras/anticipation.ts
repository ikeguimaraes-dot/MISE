import {validDate,weekDays} from './alcada'
export const LEAD_LABELS={planejado:'Planejado',curto:'Curto prazo',reativo:'Reativo',emergencial:'Emergencial',desconhecido:'Data não conferida'} as const
export type LeadBand=keyof typeof LEAD_LABELS
export type LeadRow={unit_id:string;data_solicitacao:string|null;data_trabalho:string;emergencial:boolean}
export function leadBand(row:LeadRow):LeadBand{
 if(row.emergencial)return 'emergencial'
 if(!row.data_solicitacao||!validDate(row.data_solicitacao)||!validDate(row.data_trabalho))return 'desconhecido'
 const days=(Date.parse(`${row.data_trabalho}T12:00:00Z`)-Date.parse(`${row.data_solicitacao}T12:00:00Z`))/86400000
 return days>=2?'planejado':days===1?'curto':days===0?'reativo':'desconhecido'
}
export function leadMix(rows:LeadRow[]){const counts:Record<LeadBand,number>={planejado:0,curto:0,reativo:0,emergencial:0,desconhecido:0};for(const row of rows)counts[leadBand(row)]++;return {counts,total:rows.length,reactivePct:rows.length?counts.reativo/rows.length*100:null}}
export function leadWeeks(rows:LeadRow[]){const weeks=new Map<string,LeadRow[]>();for(const row of rows){if(!validDate(row.data_trabalho))continue;const week=weekDays(row.data_trabalho)[0];weeks.set(week,[...(weeks.get(week)??[]),row])}return [...weeks].sort(([a],[b])=>a.localeCompare(b)).map(([week,items])=>({week,...leadMix(items)}))}
