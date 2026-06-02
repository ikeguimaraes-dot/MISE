import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: execution_id } = await params
  const supabase = createServiceClient()

  const { data: execucao, error: execError } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .select('*')
    .eq('id', execution_id)
    .single()

  if (execError) return NextResponse.json({ error: execError.message }, { status: 404 })

  const [{ data: items }, { data: respostas }] = await Promise.all([
    supabase.schema('mise').from('checklist_template_items').select('*')
      .eq('template_id', execucao.template_id),
    supabase.schema('mise').from('checklist_responses').select('*')
      .eq('execution_id', execution_id),
  ])

  const naSet = new Set((respostas ?? []).filter(r => r.nao_aplicavel).map(r => r.item_id))
  const respostasMap = Object.fromEntries((respostas ?? []).map(r => [r.item_id, r]))

  let pontuacaoTotal = 0
  let pontuacaoObtida = 0

  for (const item of (items ?? [])) {
    if (item.peso === 0 || naSet.has(item.id)) continue
    pontuacaoTotal += item.peso

    const r = respostasMap[item.id]
    if (!r) continue

    switch (item.tipo_resposta) {
      case 'sim_nao':
        if (r.resposta?.valor === 'sim') pontuacaoObtida += item.peso
        break
      case 'checklist_multiplo': {
        const opcoes = Array.isArray(item.opcoes) ? item.opcoes : []
        const selecionados = Array.isArray(r.resposta?.selecionados) ? r.resposta.selecionados : []
        if (opcoes.length > 0) pontuacaoObtida += (selecionados.length / opcoes.length) * item.peso
        break
      }
      case 'assinatura':
        if (r.resposta?.assinatura) pontuacaoObtida += item.peso
        break
      default:
        if (r.resposta && Object.keys(r.resposta).length > 0) pontuacaoObtida += item.peso
    }
  }

  const percentual = pontuacaoTotal > 0 ? Math.round((pontuacaoObtida / pontuacaoTotal) * 10000) / 100 : 0

  const { error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .update({
      status: 'concluido',
      pontuacao_total: pontuacaoTotal,
      pontuacao_obtida: pontuacaoObtida,
      percentual,
      concluido_em: new Date().toISOString(),
    })
    .eq('id', execution_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, pontuacao_total: pontuacaoTotal, pontuacao_obtida: pontuacaoObtida, percentual })
}
