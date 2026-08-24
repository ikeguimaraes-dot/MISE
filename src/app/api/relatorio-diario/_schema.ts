// Confirmado via introspecção Sprint 0 (2026-08-24)

export const OP_86_MOTIVOS = [
  'compra_gestao',
  'producao_planejamento',
  'fornecedor_ruptura',
  'padrao_qualidade',
  'sazonalidade',
] as const
export type Op86Motivo = typeof OP_86_MOTIVOS[number]

export const PERIODOS = ['almoco', 'jantar', 'manha'] as const
export type Periodo = typeof PERIODOS[number]

export const SETORES_AVALIACAO = ['Salão', 'Cozinha', 'Bar', 'Limpeza', 'Caixa', 'Portaria'] as const
export type SetorAvaliacao = typeof SETORES_AVALIACAO[number]

export const SETORES_EQUIPE = ['Salão', 'Cozinha', 'Bar', 'Limpeza', 'Caixa'] as const
export type SetorEquipe = typeof SETORES_EQUIPE[number]

// Enum real: op_feedback_categoria — valores confirmados via introspecção
export const FEEDBACK_CATEGORIAS = ['prato', 'servico', 'ambiente'] as const
export type FeedbackCategoria = typeof FEEDBACK_CATEGORIAS[number]

export const OCORRENCIA_RH_TIPOS = [
  'falta', 'atestado', 'saida_antecipada', 'contratacao', 'desligamento', 'outro',
] as const
export type OcorrenciaRhTipo = typeof OCORRENCIA_RH_TIPOS[number]

export const CONTA_ASSINADA_CATEGORIAS = [
  'Sócios', 'MKT', 'Eventos', 'Administrativo', 'Promoter', 'DJs', 'Cortesia', 'Operacional',
] as const
export type ContaAssinadaCategoria = typeof CONTA_ASSINADA_CATEGORIAS[number]

export const TEMPO_OPCOES = ['Sol', 'Nublado', 'Chuva leve', 'Chuva forte', 'Frio', 'Calor'] as const
export type TempoOpcao = typeof TEMPO_OPCOES[number]

export const PERIODO_LABEL: Record<string, string> = {
  almoco: 'Almoço',
  jantar: 'Jantar',
  manha: 'Manhã',
}

// Tabelas confirmadas na introspecção (2026-08-24):
// AUSENTES do cache REST: op_periodo, op_portaria, op_enxoval, op_ocorrencia_rh, op_conta_assinada
// PRESENTES: op_relatorio_diario, op_86, op_feedback_cliente, op_portaria_desistencia, op_pendura, op_unit_config
export const SCHEMA = {
  relatorio: 'op_relatorio_diario',
  op_86: 'op_86',
  feedback: 'op_feedback_cliente',
  pendura: 'op_pendura',
  portaria_desistencia: 'op_portaria_desistencia',
  unit_config: 'op_unit_config',
} as const
