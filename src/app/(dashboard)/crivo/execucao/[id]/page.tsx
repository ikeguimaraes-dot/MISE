import { createServiceClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import { CrivoExecucaoClient } from './_components/crivo-execucao-client'

export default async function CrivoExecucaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const { id } = await params
  const supabase = createServiceClient()

  const { data: execucao } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .select('id, template_id, unit_id, status')
    .eq('id', id)
    .single()

  if (!execucao) notFound()
  if (execucao.status === 'concluido') {
    redirect(execucao.unit_id ? `/crivo/${execucao.unit_id}` : '/crivo')
  }

  // If still 'agendado', mark it as em_andamento
  if (execucao.status === 'agendado') {
    await supabase
      .schema('mise')
      .from('checklist_executions')
      .update({ status: 'em_andamento', iniciado_em: new Date().toISOString() })
      .eq('id', id)
  }

  const [{ data: template }, { data: itemsRaw }, { data: respostas }] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('nome').eq('id', execucao.template_id).single(),
    supabase.schema('mise').from('checklist_template_items')
      .select('id, ordem, titulo, descricao, tipo_resposta, opcoes, peso, requer_comentario, criterio_regramento, requer_foto')
      .eq('template_id', execucao.template_id)
      .eq('ativo', true)
      .order('ordem'),
    supabase.schema('mise').from('checklist_responses')
      .select('item_id, resposta, comentario, nao_aplicavel, foto_url')
      .eq('execution_id', id),
  ])

  if (!template) notFound()

  const items = (itemsRaw ?? []).map(item => ({
    ...item,
    descricao: item.descricao ?? null,
    requer_comentario: String(item.requer_comentario ?? 'nao'),
    criterio_regramento: item.criterio_regramento as string | null ?? null,
    requer_foto: String(item.requer_foto ?? 'nao'),
  }))

  return (
    <CrivoExecucaoClient
      executionId={id}
      unitId={execucao.unit_id ?? ''}
      templateNome={template.nome}
      items={items}
      existingRespostas={(respostas ?? []).map(r => ({
        item_id: r.item_id,
        resposta: r.resposta as Record<string, unknown> | null,
        comentario: r.comentario,
        nao_aplicavel: r.nao_aplicavel,
        foto_url: r.foto_url,
      }))}
    />
  )
}
