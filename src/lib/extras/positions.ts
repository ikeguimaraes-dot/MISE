import type { OperationalRole } from './workflow'
export type PositionRequest = {
 id:string;unit_id:string;data_trabalho:string;periodo:string;setor:string;funcao:string;
 quantidade:number;valor_unitario:number;valor_total:number;valor_consumido:number;valor_nomeado:number;
 preenchidos:number;pagamentos_pendentes:number;motivo:string;motivo_detalhe:string;solicitante_nome:string;
 pagadora:string;status:string;emergencial:boolean;mise_managed:boolean;mise_requested_by:string|null;
 mise_version:number;mise_named_at:string|null;mise_emergency_decision:string|null;
}
export const REQUEST_SELECT = 'id,unit_id,data_trabalho,periodo,setor,funcao,quantidade,valor_unitario,valor_total,valor_consumido,valor_nomeado,preenchidos,pagamentos_pendentes,motivo,motivo_detalhe,solicitante_nome,pagadora,status,emergencial,mise_managed,mise_requested_by,mise_version,mise_named_at,mise_emergency_decision'
export function positionActions(item:PositionRequest,role:OperationalRole,employee:string) {
 if(!item.mise_managed || ['cancelado','recusado'].includes(item.status)) return []
 const result:string[]=[]
 if(role==='diretor' && item.emergencial && !item.mise_emergency_decision) result.push('ratificar_emergencia','nao_ratificar_emergencia')
 if(role==='diretor' && item.status==='aguardando_diretoria') result.push('aprovar','recusar')
 if(role==='lider' && item.mise_requested_by===employee && ['solicitado','aguardando_diretoria'].includes(item.status)) result.push('cancelar')
 if(role==='rh' && ['solicitado','aprovado_rh'].includes(item.status) && item.preenchidos<item.quantidade) result.push('nomear_rh')
 return result
}
export function positionStatus(item:PositionRequest) {
 if(item.status==='aguardando_diretoria')return 'Diretoria · aprovação'
 if(item.status==='cancelado')return 'Cancelada'
 if(item.status==='recusado')return 'Recusada'
 if(item.preenchidos===0)return 'RH · nomear pessoas'
 if(item.preenchidos<item.quantidade)return 'Parcialmente atendida'
 return item.pagamentos_pendentes ? 'Pessoas nomeadas · pagamentos individuais' : 'Atendida · pagamentos concluídos'
}
