// Derivado do plano + introspecção parcial — confirmar colunas críticas via Sprint 0
// quando a conexão com o banco estiver disponível.

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

export const FEEDBACK_CATEGORIAS = ['Produto', 'Serviço', 'Pagamento', 'Ambiente', 'Outro'] as const
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

// Nomes de tabelas e colunas a confirmar via introspecção:
// - op_86: coluna produto_nome (NÃO produto)
// - op_feedback_cliente: coluna produto (NÃO produto_nome)
// - op_periodo: confirmar nome exato da tabela e colunas enviado_por / enviado_em
// - op_portaria_desistencia: motivo deve ser nullable
// - employees: confirmar existência de coluna unit_id
export const SCHEMA = {
  relatorio: 'op_relatorio_diario',
  periodo: 'op_periodo',
  op_86: 'op_86',
  enxoval: 'op_enxoval',
  feedback: 'op_feedback_cliente',
  rh: 'op_ocorrencia_rh',
  pendura: 'op_pendura',
  conta_assinada: 'op_conta_assinada',
  portaria: 'op_portaria',
  portaria_desistencia: 'op_portaria_desistencia',
  unit_config: 'op_unit_config',
} as const
