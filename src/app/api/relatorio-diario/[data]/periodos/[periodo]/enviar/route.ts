import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'
import { emitTurnoEvent } from '@/app/api/relatorio-diario/_ledger'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ data: string; periodo: string }> }
) {
  const { data: dataParam, periodo } = await params
  const body = await request.json()
  const { unit_id } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()

  // 1. Buscar config da unidade — nunca aceitar periodos_ativos do payload
  const { data: unitConfig } = await supabase
    .from('op_unit_config')
    .select('periodos_ativos')
    .eq('unit_id', unit_id)
    .single()

  const ativos: string[] = (unitConfig?.periodos_ativos as string[] | null) ?? ['almoco', 'jantar']

  // 2. Buscar relatorio
  const { data: relatorio } = await supabase
    .from('op_relatorio_diario')
    .select('id, status')
    .eq('unit_id', unit_id)
    .eq('data', dataParam)
    .single()

  if (!relatorio) {
    return NextResponse.json({ error: 'Relatório não encontrado. Reabra a página e tente novamente.' }, { status: 404 })
  }
  if (relatorio.status === 'enviado') {
    return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })
  }

  // 3. Buscar período — save-then-submit: deve existir (autosave garantiu isso)
  const { data: per } = await supabase
    .from('op_periodo')
    .select('id, enviado_em')
    .eq('relatorio_id', relatorio.id)
    .eq('tipo', periodo)
    .single()

  if (!per) {
    return NextResponse.json(
      { error: 'Período não encontrado no banco. Aguarde o salvamento e tente novamente.' },
      { status: 404 }
    )
  }
  if (per.enviado_em) {
    return NextResponse.json({ error: 'Período já enviado.' }, { status: 409 })
  }

  // 4. Marcar período como enviado
  const agora = new Date().toISOString()
  const { error: errPer } = await supabase
    .from('op_periodo')
    .update({ enviado_por: auth.employeeId, enviado_em: agora })
    .eq('id', per.id)

  if (errPer) return NextResponse.json({ error: errPer.message }, { status: 500 })

  // 5. Verificar se TODOS os períodos configurados estão agora enviados
  const { data: todosPeriodos } = await supabase
    .from('op_periodo')
    .select('tipo, enviado_em')
    .eq('relatorio_id', relatorio.id)
    .in('tipo', ativos)

  const todosEnviados = ativos.every(tipo =>
    todosPeriodos?.some(p => p.tipo === tipo && p.enviado_em)
  )

  // 6. Fechar o dia se todos enviados
  if (todosEnviados) {
    await supabase
      .from('op_relatorio_diario')
      .update({ status: 'enviado' })
      .eq('id', relatorio.id)

    await emitTurnoEvent({
      type: 'turno.closed',
      unitId: unit_id,
      entityId: relatorio.id,
      actorId: auth.employeeId,
      occurredAt: agora,
      payload: { data: dataParam },
    })
  } else {
    await emitTurnoEvent({
      type: 'turno.period.closed',
      unitId: unit_id,
      entityId: per.id,
      actorId: auth.employeeId,
      occurredAt: agora,
      payload: { periodo, data: dataParam },
    })
  }

  return NextResponse.json({ ok: true, diaClosed: todosEnviados })
}
