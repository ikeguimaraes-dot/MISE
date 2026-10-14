export type ExtraJob={id:string;nome:string;setor_padrao:string;valor_referencia:number|null;ordem:number|null}
export const EXTRA_MOTIVES=[['falta_atestado','Falta / atestado'],['ferias','Férias'],['folga','Folga'],['quadro_clt','Quadro CLT'],['evento','Evento'],['teste_vaga','Teste de vaga']] as const
export const jobSectors=(jobs:ExtraJob[])=>[...new Set(jobs.map(j=>j.setor_padrao))]
