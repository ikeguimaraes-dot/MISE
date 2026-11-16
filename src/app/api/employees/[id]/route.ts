import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireMiseRole } from '@/lib/session'
import { isUuid } from '@/lib/business-registration'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireMiseRole(['admin'])
  if (!actor) return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Funcionário inválido.' }, { status: 400 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }) }
  if (!body || typeof body.mise_ativo !== 'boolean' || Object.keys(body).some(key => key !== 'mise_ativo')) return NextResponse.json({ error: 'Informe apenas a ativação do acesso ao MISE.' }, { status: 400 })
  if (id === actor.employeeId && !body.mise_ativo) return NextResponse.json({ error: 'Você não pode desativar o próprio acesso.' }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('employees').update({ mise_ativo: body.mise_ativo }).eq('id', id).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Não foi possível atualizar o acesso.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
