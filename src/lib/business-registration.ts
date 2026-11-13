export const BRAZIL_STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const

export const BUSINESS_TEXT_FIELDS = ['name', 'legal_name', 'cnpj', 'state_registration', 'municipal_registration', 'cnae', 'postal_code', 'street', 'street_number', 'complement', 'district', 'city', 'state', 'phone', 'email', 'website', 'contact_name', 'notes'] as const
export type BusinessTextField = typeof BUSINESS_TEXT_FIELDS[number]
export type BusinessRegistration = Record<BusinessTextField, string | null> & { id: string; active: boolean | null; company_id?: string | null; address?: string | null }
export type CompanyOption = { id: string; name: string; active: boolean }
export type BusinessKind = 'empresa' | 'unidade'

export const BUSINESS_COLUMNS = `id,${BUSINESS_TEXT_FIELDS.join(',')},active`

// Receita Federal: módulo 11; caracteres alfanuméricos usam ASCII menos 48.
export function normalizeCnpj(value: string): string {
  return value.trim().toUpperCase().replace(/[.\/\-\s]/g, '')
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value)
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false
  function digit(base: string, weights: number[]) {
    const remainder = [...base].reduce((sum, char, index) => sum + (char.charCodeAt(0) - 48) * weights[index], 0) % 11
    return remainder < 2 ? '0' : String(11 - remainder)
  }
  const first = digit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = digit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return cnpj.slice(12) === first + second
}

export function formatCnpj(value: string | null | undefined): string {
  if (!value) return 'Não informado'
  const cnpj = normalizeCnpj(value)
  return cnpj.length === 14 ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` : value
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function validateBusinessRegistration(input: unknown, kind: BusinessKind) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Cadastro inválido.')
  const body = input as Record<string, unknown>
  const data = {} as Record<BusinessTextField, string | null> & { active: boolean; company_id?: string; address?: string; whatsapp_number?: string | null; updated_at: string }
  for (const field of BUSINESS_TEXT_FIELDS) {
    if (body[field] != null && typeof body[field] !== 'string') throw new Error(`Valor inválido: ${field}.`)
    const text = (body[field] as string | null | undefined)?.trim() ?? ''
    if (text.length > (field === 'notes' ? 4000 : 250)) throw new Error(`Campo muito longo: ${field}.`)
    data[field] = text || null
  }
  for (const [field, label] of [['name', kind === 'empresa' ? 'nome fantasia' : 'nome da unidade'], ['legal_name', 'razão social'], ['cnpj', 'CNPJ'], ['postal_code', 'CEP'], ['street', 'logradouro'], ['street_number', 'número'], ['district', 'bairro'], ['city', 'cidade'], ['state', 'UF']] as const) {
    if (!data[field]) throw new Error(`Preencha ${label}.`)
  }
  data.cnpj = normalizeCnpj(data.cnpj!)
  if (!isValidCnpj(data.cnpj)) throw new Error('CNPJ inválido. Confira os caracteres e dígitos verificadores.')
  data.postal_code = data.postal_code!.replace(/[.\-\s]/g, '')
  if (!/^\d{8}$/.test(data.postal_code)) throw new Error('CEP inválido. Informe 8 dígitos.')
  data.state = data.state!.toUpperCase()
  if (!BRAZIL_STATES.some(state => state === data.state)) throw new Error('Selecione uma UF válida.')
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('E-mail inválido.')
  if (data.phone && !/^\+?[\d\s().-]{8,25}$/.test(data.phone)) throw new Error('Telefone inválido. Informe o DDD e o número.')
  if (data.cnae) {
    data.cnae = data.cnae.replace(/[.\-\s/]/g, '')
    if (!/^\d{7}$/.test(data.cnae)) throw new Error('CNAE inválido. Informe 7 dígitos.')
  }
  if (data.website) {
    try {
      const url = new URL(/^https?:\/\//i.test(data.website) ? data.website : `https://${data.website}`)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error()
      data.website = url.toString()
    } catch { throw new Error('Site inválido.') }
  }
  if (typeof body.active !== 'boolean') throw new Error('Informe se o cadastro está ativo.')
  data.active = body.active
  data.updated_at = new Date().toISOString()
  if (kind === 'unidade') {
    if (!isUuid(body.company_id)) throw new Error('Selecione a empresa da unidade.')
    data.company_id = body.company_id
    data.address = `${data.street}, ${data.street_number}${data.complement ? `, ${data.complement}` : ''} — ${data.district}, ${data.city}/${data.state}, CEP ${data.postal_code}`
    data.whatsapp_number = data.phone
  }
  return data
}
