import { requestRoute, type WeeklyBudget } from '../../lib/extras/alcada.ts'

export type Role = 'Líder' | 'RH' | 'Financeiro' | 'Caixa' | 'Diretor de Operação'
export type Status = 'aguardando_diretoria' | 'aprovado_rh' | 'solicitado' | 'aguardando_diretor' | 'aprovado_operacao' | 'reservado' | 'informado' | 'pago' | 'recusado' | 'cancelado'
export type Action = 'aprovar_emergencia' | 'aprovar_operacao' | 'preparar_rh' | 'reservar' | 'informar' | 'regularizar' | 'conferir' | 'recusar' | 'cancelar'
export type Extra = {
  workflow?: 'weekly'; approvedAmount?: number; excess?: number;
  id: string; unit: string; day: string; period: string; sector: string; job: string; reason: string; detail: string;
  requester: string; name: string; value: number; payer: 'Casa' | 'Estaff'; identityChecked: boolean;
  emergency: boolean; emergencyApproved: boolean; rhComplete: boolean; receipt: boolean; status: Status;
  stageAt: string; history: { at: string; actor: Role | 'Ike' | 'Sistema'; text: string }[];
}
export const ROLES: Role[] = ['Líder', 'RH', 'Financeiro', 'Caixa', 'Diretor de Operação']
export const SECTORS = ['Salão', 'Cozinha Meet', 'Cozinha Produção', 'Parrilla', 'Bar', 'Limpeza', 'Caixa', 'Portaria']
export const STATUS: Record<Status, string> = { aguardando_diretoria: 'Aguardando diretoria', aprovado_rh: 'Conferido pelo RH', solicitado: 'Solicitado', aguardando_diretor: 'Aguardando Diretor', aprovado_operacao: 'Aprovado pela Operação', reservado: 'Liberado pelo Financeiro', informado: 'Pagamento informado', pago: 'Pago · conferido', recusado: 'Recusado', cancelado: 'Cancelado' }
export const LABELS: Record<Action, string> = { aprovar_emergencia: 'Aprovar emergência', aprovar_operacao: 'Aprovar solicitação', preparar_rh: 'Completar cadastro no RH', reservar: 'Reservar / liberar', informar: 'Informar pagamento', regularizar: 'Regularizar cadastro', conferir: 'Conferir e encerrar', recusar: 'Recusar solicitação', cancelar: 'Cancelar solicitação' }
export const money = (value: number) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export function parseMoney(value: string): number {
  const clean = value.replace(/R\$|\s/g, '')
  if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(clean)) return NaN
  return Math.round(Number(clean.replaceAll('.', '').replace(',', '.')) * 100)
}
export function total(item: Extra) { return item.value }
export function isActive(item: Extra) { return item.status !== 'cancelado' && item.status !== 'recusado' }
export function actionsFor(item: Extra, role: Role): Action[] {
  if (!isActive(item) || item.status === 'pago') return []
  if (item.workflow === 'weekly') {
    if (item.status === 'aguardando_diretoria') return role === 'Diretor de Operação' ? ['aprovar_operacao', 'recusar'] : role === 'Líder' ? ['cancelar'] : []
    if (item.emergency && ['solicitado', 'aprovado_rh'].includes(item.status)) return role === (item.payer === 'Casa' ? 'Caixa' : 'Financeiro') ? ['informar'] : role === 'RH' ? ['preparar_rh'] : role === 'Líder' ? ['cancelar'] : []
    if (item.status === 'aprovado_rh') return role === 'Financeiro' ? ['reservar'] : []
  }
  if (item.workflow !== 'weekly' && item.emergency && !item.emergencyApproved) return role === 'Diretor de Operação' ? ['aprovar_emergencia', 'recusar'] : role === 'Líder' || role === 'Caixa' ? ['cancelar'] : []
  if (item.status === 'informado') {
    if (!item.rhComplete) return role === 'RH' ? ['regularizar'] : []
    return role === 'Financeiro' ? ['conferir'] : []
  }
  if (item.emergency && item.emergencyApproved && item.status === 'solicitado') {
    if (role === 'Caixa') return ['informar']
    if (role === 'RH') return ['preparar_rh']
  }
  if (item.status === 'solicitado') return role === 'RH' ? ['preparar_rh'] : role === 'Líder' ? ['cancelar'] : []
  if (item.status === 'aguardando_diretor') return role === 'Diretor de Operação' ? ['aprovar_operacao', 'recusar'] : []
  if (item.status === 'aprovado_operacao') {
    if (item.emergency && item.payer === 'Casa' && role === 'Caixa') return ['informar']
    return role === 'Financeiro' ? ['reservar'] : []
  }
  if (item.status === 'reservado') return role === (item.payer === 'Casa' ? 'Caixa' : 'Financeiro') ? ['informar'] : []
  return []
}
export function nextOwner(item: Extra): string {
  if (!isActive(item) || item.status === 'pago') return 'Processo encerrado'
  if (item.workflow === 'weekly' && item.emergency && ['solicitado', 'aprovado_rh'].includes(item.status)) return `${item.payer === 'Casa' ? 'Caixa' : 'Financeiro · Estaff'} · exceção emergencial; alerta demonstrativo`
  if (item.workflow !== 'weekly' && item.emergency && !item.emergencyApproved) return 'Diretor de Operação · aprovação prévia'
  if (item.status === 'informado') return item.rhComplete ? 'Financeiro · conferência' : 'RH · regularização'
  if (item.emergency && item.emergencyApproved && item.status === 'solicitado') return 'Caixa · pagamento autorizado'
  return ({ aguardando_diretoria: 'Diretor de Operação · aprovação da alçada', aprovado_rh: 'Financeiro · liberação', solicitado: 'RH · completar cadastro', aguardando_diretor: 'Diretor de Operação · aprovação', aprovado_operacao: item.emergency && item.payer === 'Casa' ? 'Caixa · pagamento autorizado' : 'Financeiro · liberação', reservado: item.payer === 'Casa' ? 'Caixa · pagamento' : 'Financeiro · Estaff', informado: '', pago: '', recusado: '', cancelado: '' })[item.status]
}
export function transition(item: Extra, role: Role, action: Action, patch: Partial<Extra> = {}, note = '', at = new Date().toISOString(), budget?: WeeklyBudget): Extra {
  if (!actionsFor(item, role).includes(action)) throw new Error('Esta etapa não está disponível para este papel ou já foi concluída.')
  const next: Extra = { ...item }
  if (action === 'preparar_rh' || action === 'regularizar') {
    if (!patch.name?.trim() || !patch.identityChecked) throw new Error('Informe o nome de exemplo e confirme a identificação demonstrativa.')
    if (!Number.isSafeInteger(patch.value) || patch.value! <= 0) throw new Error('Informe valor positivo, em reais.')
    if (patch.payer !== 'Casa' && patch.payer !== 'Estaff') throw new Error('Selecione a pagadora.')
    if (item.status === 'informado' && (patch.value !== item.value || patch.payer !== item.payer)) throw new Error('O pagamento já foi informado. Valores e pagadora não podem ser alterados.')
    if (item.emergencyApproved && (patch.value !== item.value || patch.payer !== item.payer)) throw new Error('Preserve o valor e a pagadora autorizados pelo Diretor de Operação.')
    Object.assign(next, { name: patch.name.trim(), identityChecked: true, value: patch.value, payer: patch.payer, rhComplete: true })
    if (action === 'preparar_rh') {
      if (item.workflow === 'weekly') {
        if (!budget) throw new Error('Recalcule a alçada antes de completar o cadastro.')
        const route = requestRoute(budget, total(next), item.emergency)
        next.excess = route.excesso
        // Approval covers the recorded amount only. Increases get checked again.
        next.status = route.status === 'aguardando_diretoria' && total(next) > (item.approvedAmount ?? 0) ? 'aguardando_diretoria' : 'aprovado_rh'
      } else next.status = item.emergencyApproved ? 'aprovado_operacao' : 'aguardando_diretor'
    }
  } else if (action === 'aprovar_operacao') {
    if ((item.workflow !== 'weekly' && !item.rhComplete) || total(item) <= 0) throw new Error('O RH precisa completar o cadastro e o valor antes da aprovação.')
    if (!note.trim()) throw new Error('Registre a justificativa da decisão do Diretor.')
    next.status = item.workflow === 'weekly' ? (item.rhComplete ? 'aprovado_rh' : 'solicitado') : 'aprovado_operacao'
    if (item.workflow === 'weekly') next.approvedAmount = total(item)
  } else if (action === 'aprovar_emergencia') {
    if (!note.trim()) throw new Error('Registre o motivo da autorização prévia.')
    next.emergencyApproved = true
  } else if (action === 'reservar') next.status = 'reservado'
  else if (action === 'informar') {
    if (!patch.receipt) throw new Error('Anexe o recibo demonstrativo antes de informar o pagamento.')
    if (!item.name.trim() || total(item) <= 0) throw new Error('Identifique o recebedor e o valor antes do pagamento.')
    next.receipt = true; next.status = 'informado'
  } else if (action === 'conferir') {
    if (!item.receipt || !item.rhComplete) throw new Error('Confira o comprovante e a regularização do RH.')
    next.status = 'pago'
  } else {
    if (!note.trim()) throw new Error('Informe um motivo para encerrar a solicitação.')
    next.status = action === 'recusar' ? 'recusado' : 'cancelado'
  }
  next.stageAt = at
  next.history = [...item.history, { at, actor: role, text: `${LABELS[action]}${note.trim() ? ` — ${note.trim()}` : ''}` }]
  return next
}

export function samples(today: string, weekly = false): Extra[] {
  const at = `${today}T09:00:00-03:00`
  const base: Extra = { id: 'EX-101', unit: 'Meet & Eat', day: today, period: 'Almoço', sector: 'Cozinha Meet', job: 'Auxiliar de cozinha', reason: 'Folga', detail: 'Cobertura do almoço · exemplo', requester: 'Líder · demonstração', name: '', value: 0, payer: 'Casa', identityChecked: false, emergency: false, emergencyApproved: false, rhComplete: false, receipt: false, status: 'solicitado', stageAt: at, history: [{ at, actor: 'Líder', text: 'Solicitação criada · dados de exemplo' }] }
  const awaiting = transition({ ...base, id: 'EX-102', sector: 'Salão', job: 'Garçom', period: 'Jantar' }, 'RH', 'preparar_rh', { name: 'Pessoa exemplo A', value: 15000, identityChecked: true, payer: 'Casa' }, '', at)
  const approved = transition(awaiting, 'Diretor de Operação', 'aprovar_operacao', {}, 'Cobertura aprovada · demonstração', at)
  const reserved = transition({ ...approved, id: 'EX-103', sector: 'Bar', job: 'Bartender', name: 'Pessoa exemplo B' }, 'Financeiro', 'reservar', {}, '', at)
  const reported = transition({ ...reserved, id: 'EX-104', name: 'Pessoa exemplo C', sector: 'Portaria', job: 'Porteiro', value: 18000 }, 'Caixa', 'informar', { receipt: true }, '', at)
  const emergency = { ...base, id: 'EX-105', name: 'Pessoa exemplo D', value: 16000, emergency: true, reason: 'Falta / atestado', detail: 'Ausência informada no dia. Aguardando autorização prévia.', history: [{ at, actor: 'Caixa' as Role, text: 'Demanda emergencial registrada · aguarda Diretor de Operação' }] }
  const thirdParty = { ...approved, id: 'EX-106', unit: 'Match Point', sector: 'Limpeza', job: 'Auxiliar de limpeza', name: 'Pessoa exemplo E', payer: 'Estaff' as const, value: 15000 }
  if (weekly) return [
    { ...base, workflow: 'weekly', value: 15000 },
    { ...base, id: 'EX-102', workflow: 'weekly', value: 510000, status: 'aguardando_diretoria', detail: 'Exemplo de pedido acima da alçada. Diretoria decide antes do RH.', history: [{ at, actor: 'Líder', text: 'Solicitação acima da alçada · aguarda diretoria' }] },
    { ...reserved, workflow: 'weekly' }, { ...reported, workflow: 'weekly' },
    { ...emergency, workflow: 'weekly', detail: 'Ausência no dia. Exceção emergencial com alerta demonstrativo.', history: [{ at, actor: 'Caixa', text: 'Emergência registrada · alerta imediato à diretoria (simulação)' }] },
    { ...thirdParty, workflow: 'weekly', status: 'aprovado_rh' },
  ]
  return [base, awaiting, reserved, reported, emergency, thirdParty]
}

// Keep local tests and historical events; do not invent director approvals for v1.
export function upgradePreview(items: Extra[], version: number): Extra[] {
  if (version >= 2) return items
  return items.map(item => {
    const status = item.status as string
    if (status === 'aprovado_rh' || status === 'reservado' || item.emergency && item.emergencyApproved && status === 'solicitado') {
      const at = new Date().toISOString()
      return { ...item, status: item.emergency ? 'solicitado' as const : 'aguardando_diretor' as const, emergencyApproved: false, stageAt: at, history: [...item.history, { at, actor: 'Sistema' as const, text: 'Prévia atualizada: autorização do Diretor de Operação necessária antes de continuar.' }] }
    }
    return item
  })
}
