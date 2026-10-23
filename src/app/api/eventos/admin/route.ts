import { createClient } from '@supabase/supabase-js'
import { requireMiseRole } from '@/lib/session'

const supabaseUrl = 'https://rpavxnjchfmeiacnumpk.supabase.co'
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

async function handle(request: Request) {
  // Exigir também o administrador do MISE: o perfil legado de Eventos
  // pode ser alterado por usuários autenticados nas políticas existentes.
  if (!await requireMiseRole(['admin'])) return Response.json({ message: 'Acesso restrito a administradores do MISE.' }, { status: 403 })
  const key = process.env.EVENTOS_SUPABASE_SERVICE_ROLE_KEY
  if (!key) return Response.json({ message: 'Administração de eventos não configurada.' }, { status: 503 })
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return Response.json({ message: 'Entre no sistema de eventos.' }, { status: 401 })
  const client = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) return Response.json({ message: 'Sessão de eventos inválida.' }, { status: 401 })
  const { data: profile } = await client.from('usuarios').select('nivel_acesso').eq('auth_id', user.id).single()
  if (!profile || !['admin', 'master'].includes(profile.nivel_acesso)) return Response.json({ message: 'Sem permissão para gerenciar usuários.' }, { status: 403 })

  const target = new URL(request.url).searchParams.get('path') ?? ''
  const valid = request.method === 'POST' ? target === '/auth/v1/admin/users' : new RegExp(`^/auth/v1/admin/users/${uuid}$`, 'i').test(target)
  if (!valid) return Response.json({ message: 'Operação inválida.' }, { status: 400 })
  try {
    let body: Record<string, unknown> | undefined
    if (request.method === 'POST' || request.method === 'PUT') {
      const input = await request.json()
      if (typeof input.password !== 'string' || input.password.length < 6) return Response.json({ message: 'Senha inválida.' }, { status: 400 })
      body = { password: input.password }
      if (request.method === 'POST') {
        if (typeof input.email !== 'string' || !input.email.includes('@')) return Response.json({ message: 'E-mail inválido.' }, { status: 400 })
        body = { ...body, email: input.email, email_confirm: true }
      }
    }
    if (request.method === 'DELETE') {
      const id = target.split('/').pop()
      const { data: targetProfile, error: lookupError } = await client.from('usuarios').select('nivel_acesso').eq('auth_id', id!).maybeSingle()
      if (lookupError || id === user.id || targetProfile?.nivel_acesso === 'master') return Response.json({ message: 'Este usuário não pode ser excluído.' }, { status: 403 })
    }
    const upstream = await fetch(`${supabaseUrl}${target}`, {
      method: request.method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ message: 'Não foi possível concluir a operação.' }, { status: 502 })
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE }
