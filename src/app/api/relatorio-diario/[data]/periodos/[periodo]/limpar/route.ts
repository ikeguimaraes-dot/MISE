import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getMiseSession } from '@/lib/session'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ data: string; periodo: string }> }
) {
  const { data: dataParam, periodo } = await params
  const body = await request.json()
  const { unit_id, sequencia: seqRaw } = body
  const sequencia: number = typeof seqRaw === 'number' ? seqRaw : 1

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })

  const session = await getMiseSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Só admin pode limpar dados de um período.' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: relatorio } = await supabase
    .from('op_relatorio_diario')
    .select('id')
    .eq('unit_id', unit_id)
    .eq('data', dataParam)
    .single()

  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })

  // Zera os campos do período, mantém a linha e reabre pra edição
  await supabase.from('op_relatorio_periodo')
    .update({
      status: 'rascunho',
      enviado_em: null,
      na_motivo: null,
      venda_total: null,
      venda_alimentos: null,
      venda_bebidas: null,
      taxa_servico: null,
      delivery: null,
      portaria: null,
      perda_produto: null,
      desconto: null,
      horario_abertura: null,
      horario_ultimo_cliente: null,
      horario_fechamento: null,
      evento_nome: null,
      evento_contato: null,
    })
    .eq('relatorio_id', relatorio.id)
    .eq('periodo', periodo)
    .eq('sequencia', sequencia)

  // Apaga avaliação de setores e faltas de equipe daquele período
  await supabase.from('op_avaliacao_setor').delete()
    .eq('relatorio_id', relatorio.id).eq('periodo', periodo).eq('sequencia', sequencia)
  await supabase.from('op_falta_equipe').delete()
    .eq('relatorio_id', relatorio.id).eq('periodo', periodo).eq('sequencia', sequencia)

  // Desistências de portaria daquele período
  // ⚠️ sem coluna sequencia nesta tabela — afeta todos os eventos do dia se periodo='eventos'
  await supabase.from('op_portaria_desistencia').delete()
    .eq('relatorio_id', relatorio.id).eq('periodo', periodo)

  // Se o relatório do dia estava "enviado", volta pra rascunho — senão o dia
  // fica marcado como fechado com um período agora vazio
  await supabase.from('op_relatorio_diario')
    .update({ status: 'rascunho' })
    .eq('id', relatorio.id)

  return NextResponse.json({ ok: true })
}
