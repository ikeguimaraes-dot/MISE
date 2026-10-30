import { getMiseSession } from '@/lib/session'

export const dynamic = 'force-dynamic'
const endpoint = 'https://rpavxnjchfmeiacnumpk.supabase.co/rest/v1/eventos'
const fields = new Set([
  'extras_valor', 'extras_valor_pago', 'extras_status', 'extras_meio', 'extras_local', 'extras_observacoes', 'custo_evento', 'valor_cobrado', 'valor_pago_parcial', 'status', 'casa', 'espacos', 'tipo_evento', 'tema', 'nome_evento', 'contato',
  'pagamento_status', 'pagamento_meio', 'situacao_pagamento', 'responsavel_comercial', 'responsavel_operacional',
  'data_inicio', 'hora_inicio', 'hora_termino', 'num_convidados', 'briefing_cliente',
  'acesso_entrada', 'acesso_obs', 'mobiliario', 'mobiliario_obs', 'fotografia',
  'valet', 'artistico', 'artistico_obs', 'gerador', 'ambulancia', 'menores',
  'montagem', 'montagem_descricao', 'brigada', 'menu_bar', 'menu_cozinha',
  'campo_livre', 'tempos_movimentos', 'layout_anexos', 'comprovantes_pagamento',
])
const financialFields = new Set(['extras_valor', 'extras_valor_pago', 'extras_status', 'extras_meio', 'extras_local', 'extras_observacoes', 'custo_evento', 'valor_cobrado', 'valor_pago_parcial', 'situacao_pagamento', 'pagamento_status', 'pagamento_meio', 'comprovantes_pagamento'])
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (message: string, status: number) => Response.json({ message }, { status, headers })

async function handle(request: Request) {
  const session = await getMiseSession()
  if (!session) return fail('Sua sessão do MISE expirou. Entre novamente no MISE.', 401)
  if (!['admin', 'gerente', 'cozinheiro'].includes(session.role)) return fail('Acesso não permitido.', 403)
  const method = request.method
  const write = method !== 'GET'
  if (write && session.role === 'cozinheiro') return fail('Seu acesso permite apenas consultar eventos.', 403)
  if (method === 'DELETE' && session.role !== 'admin') return fail('Somente administradores podem excluir eventos.', 403)
  const url = new URL(request.url)
  if (write) {
    const origin = request.headers.get('origin')
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return fail('Origem não permitida.', 403)
    if (method !== 'DELETE' && !request.headers.get('content-type')?.startsWith('application/json')) return fail('Envie os dados em JSON.', 415)
  }
  const params = url.searchParams
  for (const [name, value] of params) {
    if (name === 'section' && value === 'financeiro' && method === 'PATCH') continue
    if (name === 'id' && /^eq\.[1-9]\d*$/.test(value)) continue
    if (name === 'casa' && value.startsWith('eq.') && value.length <= 100) continue
    if (name === 'order' && /^data_inicio\.(asc|desc)$/.test(value)) continue
    if (name === 'select' && value === '*') continue
    if (name === 'limit' && /^[1-9]\d{0,2}$/.test(value)) continue
    return fail('Filtro inválido.', 400)
  }
  if ([...new Set(params.keys())].some(name => params.getAll(name).length > 1)) return fail('Filtro duplicado.', 400)
  if ((method === 'PATCH' || method === 'DELETE') && !params.has('id')) return fail('Informe a O.S. a alterar.', 400)
  const financialOnly = params.get('section') === 'financeiro'
  params.delete('section')
  const key = process.env.EVENTOS_SUPABASE_SERVICE_ROLE_KEY
  if (!key) return fail('O acesso a Eventos ainda não foi configurado neste ambiente.', 503)
  try {
    let body: Record<string, unknown> | undefined
    if (method === 'POST' || method === 'PATCH') {
      const input = await request.json()
      if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Dados inválidos.', 400)
      if (financialOnly && Object.keys(input).some(name => !financialFields.has(name))) return fail('Envie apenas os campos financeiros em Salvar valores.', 400)
      if (method === 'POST' && (input.id != null || params.has('id'))) return fail('Uma O.S. existente deve ser editada, não criada novamente.', 400)
      if (method === 'PATCH') {
        if (input.id != null && String(input.id) !== params.get('id')?.slice(3)) return fail('A identificação da O.S. não corresponde à edição.', 400)
        if (input.versao != null) {
          if (!Number.isSafeInteger(input.versao) || input.versao < 1) return fail('Versão inválida.', 400)
          params.set('versao', `eq.${input.versao}`)
        }
      }
      body = Object.fromEntries(Object.entries(input).filter(([name]) => fields.has(name)))
      if (!Object.keys(body).length) return fail('Informe os dados da O.S.', 400)
      for (const field of ['custo_evento', 'valor_cobrado', 'valor_pago_parcial', 'extras_valor', 'extras_valor_pago']) {
        const value = body[field]
        if (value !== undefined && value !== null && (
          typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9999999999.99 ||
          Math.abs(value * 100 - Math.round(value * 100)) > 0.0001
        )) return fail('Informe valores financeiros válidos, não negativos e com até duas casas decimais.', 400)
      }
      for (const [name, allowed] of [['pagamento_status', ['Pago', 'A pagar', 'Pagamento parcial']], ['pagamento_meio', ['Cartão', 'Pix', 'Boleto']]] as const) {
        if (body[name] != null && !(allowed as readonly unknown[]).includes(body[name])) return fail('Opção de pagamento inválida.', 400)
      }
      if (body.pagamento_status === 'Pagamento parcial' && !(typeof body.valor_pago_parcial === 'number' && body.valor_pago_parcial > 0)) return fail('Informe o valor já pago no pagamento parcial.', 400)
      for (const [name, allowed] of [['extras_status', ['Pago integralmente', 'Pagamento parcial', 'Não pago']], ['extras_meio', ['Cartão', 'Pix', 'Boleto', 'Dinheiro', 'Outro']], ['extras_local', ['Via Financeiro Adm', 'Via Caixa Restaurante', 'Outro']]] as const) {
        if (body[name] != null && !(allowed as readonly unknown[]).includes(body[name])) return fail('Opção de pagamento dos extras inválida.', 400)
      }
      if (body.extras_valor != null && !body.extras_status) return fail('Informe a situação do pagamento dos extras.', 400)
      if (body.extras_status != null && typeof body.extras_valor !== 'number') return fail('Informe o valor dos extras.', 400)
      if (body.extras_status === 'Pagamento parcial' && !(typeof body.extras_valor_pago === 'number' && body.extras_valor_pago > 0 && body.extras_valor_pago < Number(body.extras_valor))) return fail('O valor parcial dos extras deve ser maior que zero e menor que o valor dos extras.', 400)
      if (body.extras_observacoes != null && (typeof body.extras_observacoes !== 'string' || body.extras_observacoes.length > 5000)) return fail('Detalhes dos extras inválidos.', 400)
      if (typeof body.nome_evento === 'string') body.nome_evento = body.nome_evento.trim().toLocaleUpperCase('pt-BR')
      if (method === 'POST') {
        if (typeof body.nome_evento !== 'string' || !body.nome_evento.trim()) return fail('Informe o nome do evento.', 400)
        body.criado_por = session.employeeName
      }
      body.updated_at = new Date().toISOString()
    }
    const upstream = await fetch(`${endpoint}?${params.toString()}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    if (!upstream.ok) return fail('Não foi possível concluir a operação em Eventos. Tente novamente.', 502)
    if (upstream.status === 204) return Response.json([], { headers })
    const result = await upstream.json()
    if (method === 'PATCH' && Array.isArray(result) && !result.length) return fail(params.has('versao') ? 'Esta O.S. foi alterada ou excluída. Reabra o evento para carregar a versão atual antes de salvar.' : 'O.S. não encontrada para edição.', params.has('versao') ? 409 : 404)
    return new Response(JSON.stringify(result), { status: upstream.status, headers: { ...headers, 'Content-Type': 'application/json' } })
  } catch {
    return fail('Não foi possível concluir a operação em Eventos.', 502)
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE }
