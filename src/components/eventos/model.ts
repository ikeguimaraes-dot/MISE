export type Evento = { id?: number; [key: string]: unknown }
export const casas: Record<string, string[]> = {
  'MEET & EAT': ['Salão Térreo', 'Bar Secreto', 'Rooftop'], Match: ['Salão Térreo'],
  'MADONNA CUCINA': ['Salão Térreo', 'Superior'], 'Frêneze': ['Salão Térreo', 'Sala 33', 'Deck'],
}
export const statuses: Record<string, string> = { rascunho: 'Rascunho', confirmado: 'Confirmado', em_andamento: 'Em andamento', realizado: 'Realizado', pago: 'Pago', cancelado: 'Cancelado' }
export const text = (value: unknown) => value == null ? '' : String(value)
export const money = (value: unknown) => value == null || value === '' ? 'Não informado' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
// Sum in cents to avoid floating-point artifacts. Missing amounts contribute zero;
// when neither amount was entered, the total remains unknown.
export function eventTotal(cost: unknown, rental: unknown): number | null {
  const values = [cost, rental].filter(value => value != null && value !== '')
  if (!values.length) return null
  return values.reduce<number>((sum, value) => sum + Math.round(Number(value) * 100), 0) / 100
}
export function parseMoney(value: string): number | null {
  const raw = value.trim().replace(/^R\$\s*/, '')
  if (!raw) return null
  // Brazilian grouping is accepted only with a decimal comma, avoiding ambiguous amounts.
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(raw) && !/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Informe um valor válido em reais, como 1.250,50.')
  const amount = Number(raw.includes(',') ? raw.replaceAll('.', '').replace(',', '.') : raw)
  if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99) throw new Error('O valor deve estar entre R$ 0,00 e R$ 9.999.999.999,99.')
  return amount
}
export function rows(value: unknown): Record<string, unknown>[] {
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { return [] } }
  return Array.isArray(value) ? value : []
}
export type Field = [key: string, label: string, type?: string, options?: string[]]
export const groups: { title: string; fields: Field[] }[] = [
  { title: 'Dados do evento', fields: [
    ['nome_evento', 'Nome do evento / cliente'], ['tipo_evento', 'Tipo de evento', 'select', ['Corporativo', 'Confraternização', 'Festa Aniversário', 'Jantar', 'Almoço', 'Café da Manhã', 'Fotografia', 'Palestra', 'Outro']],
    ['tema', 'Tema'], ['data_inicio', 'Data do evento', 'date'], ['hora_inicio', 'Hora de início', 'time'], ['hora_termino', 'Hora de término', 'time'],
    ['num_convidados', 'Convidados', 'number'], ['contato', 'Contato / telefone'], ['responsavel_comercial', 'Responsável comercial'], ['responsavel_operacional', 'Responsável operacional'], ['briefing_cliente', 'Briefing do cliente', 'textarea'],
  ] },
  { title: 'Valores do evento', fields: [['custo_evento', 'Custo A&B (R$)', 'money'], ['valor_cobrado', 'Locação (R$)', 'money'], ['total_evento', 'Total (R$)', 'total'], ['situacao_pagamento', 'Situação do pagamento', 'select', ['Via Financeiro Adm', 'Via Caixa Restaurante']]] },
  { title: 'Montagem e operação', fields: [['montagem', 'Tipo de montagem'], ['montagem_descricao', 'Descrição da montagem', 'textarea'], ['tempos_movimentos', 'Tempos e movimentos', 'textarea'], ['campo_livre', 'Observações e alertas', 'textarea']] },
  { title: 'Infraestrutura', fields: [['acesso_entrada', 'Acesso de entrada'], ['acesso_obs', 'Observações de portaria', 'textarea'], ['mobiliario', 'Mobiliário'], ['mobiliario_obs', 'Observações de mobiliário'], ['fotografia', 'Fotografia / vídeo'], ['valet', 'Valet'], ['artistico', 'Artístico / DJ / banda'], ['artistico_obs', 'Observações do artístico'], ['gerador', 'Gerador'], ['ambulancia', 'Ambulância'], ['menores', 'Menores']] },
]

export type SaveTarget = { kind: 'create' } | { kind: 'edit'; id: number }
export function eventSaveRequest(target: SaveTarget, event: Evento) {
  if (target.kind === 'edit') {
    if (!Number.isSafeInteger(target.id) || target.id <= 0) throw new Error('O.S. sem identificação. Reabra o evento para editar.')
    if (event.id != null && event.id !== target.id) throw new Error('A identificação da O.S. mudou. Reabra o evento.')
    return { query: `?id=eq.${target.id}`, method: 'PATCH' }
  }
  if (event.id != null) throw new Error('Uma O.S. existente deve ser editada, não cadastrada novamente.')
  return { query: '', method: 'POST' }
}
