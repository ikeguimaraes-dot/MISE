import { calculateExpiry } from '@/lib/shelf-life'

export function saoPauloIso(value: string): string {
  const iso = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}-03:00`
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) throw new Error('Data e hora inválidas.')
  return date.toISOString()
}

export function requestedLabelExpiry({ manipulation, baseHours, hours, manualExpiry, admin, supplierExpiry }: {
  manipulation: string; baseHours: number; hours?: unknown; manualExpiry?: unknown; admin: boolean; supplierExpiry?: string | null
}): string {
  let selected = baseHours
  if (hours != null) {
    if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) throw new Error('Informe um prazo positivo em horas.')
    if (!admin && hours > baseHours) throw new Error('Somente administradores podem ampliar o prazo de validade.')
    selected = hours
  }
  if (manualExpiry != null && manualExpiry !== '') {
    if (!admin) throw new Error('Somente administradores podem alterar a data de validade.')
    if (typeof manualExpiry !== 'string') throw new Error('Data de validade inválida.')
    const manual = saoPauloIso(manualExpiry)
    selected = (new Date(manual).getTime() - new Date(saoPauloIso(manipulation)).getTime()) / 3_600_000
    const limited = calculateExpiry(manipulation, selected, supplierExpiry)
    if (limited !== manual) throw new Error('A validade não pode ultrapassar a validade original do fornecedor.')
    return manual
  }
  return calculateExpiry(manipulation, selected, supplierExpiry)
}

export function inspectionText(sif?: string | null, selo?: string | null): string {
  return sif ? `SIF ${sif}` : selo && selo !== 'Nenhum' ? selo : ''
}

export function escapeLabelHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
