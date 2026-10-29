import { getMiseSession } from '@/lib/session'

export const dynamic = 'force-dynamic'
const endpoint = 'https://rpavxnjchfmeiacnumpk.supabase.co/rest/v1/eventos'
const fields = new Set([
  'custo_evento', 'valor_cobrado', 'status', 'casa', 'espacos', 'tipo_evento', 'tema', 'nome_evento', 'contato',
  'situacao_pagamento', 'responsavel_comercial', 'responsavel_operacional',
  'data_inicio', 'hora_inicio', 'hora_termino', 'num_convidados', 'briefing_cliente',
  'acesso_entrada', 'acesso_obs', 'mobiliario', 'mobiliario_obs', 'fotografia',
  'valet', 'artistico', 'artistico_obs', 'gerador', 'ambulancia', 'menores',
  'montagem', 'montagem_descricao', 'brigada', 'menu_bar', 'menu_cozinha',
  'campo_livre', 'tempos_movimentos', 'layout_anexos', 'comprovantes_pagamento',
])
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
    if (name === 'id' && /^eq\.[1-9]\d*$/.test(value)) continue
    if (name === 'casa' && value.startsWith('eq.') && value.length <= 100) continue
    if (name === 'order' && /^data_inicio\.(asc|desc)$/.test(value)) continue
    if (name === 'select' && value === '*') continue
    if (name === 'limit' && /^[1-9]\d{0,2}$/.test(value)) continue
    return fail('Filtro inválido.', 400)
  }
  if ([...new Set(params.keys())].some(name => params.getAll(name).length > 1)) return fail('Filtro duplicado.', 400)
  if ((method === 'PATCH' || method === 'DELETE') && !params.has('id')) return fail('Informe a O.S. a alterar.', 400)
  const key = process.env.EVENTOS_SUPABASE_SERVICE_ROLE_KEY
  if (!key) return fail('O acesso a Eventos ainda não foi configurado neste ambiente.', 503)
  try {
    let body: Record<string, unknown> | undefined
    if (method === 'POST' || method === 'PATCH') {
      const input = await request.json()
      if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Dados inválidos.', 400)
      body = Object.fromEntries(Object.entries(input).filter(([name]) => fields.has(name)))
      if (!Object.keys(body).length) return fail('Informe os dados da O.S.', 400)
      for (const field of ['custo_evento', 'valor_cobrado']) {
        const value = body[field]
        if (value !== undefined && value !== null && (
          typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9999999999.99 ||
          Math.abs(value * 100 - Math.round(value * 100)) > 0.0001
        )) return fail('Informe custo e valor cobrado válidos, não negativos e com até duas casas decimais.', 400)
      }
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
    return new Response(await upstream.text(), { status: upstream.status, headers: { ...headers, 'Content-Type': 'application/json' } })
  } catch {
    return fail('Não foi possível concluir a operação em Eventos.', 502)
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE }
