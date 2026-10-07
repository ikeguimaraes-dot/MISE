import {normalizeEquipmentResponses} from '@/lib/crivo/equipment'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import { CrivoExecucaoClient } from './_components/crivo-execucao-client'

function classificar(pct: number): string {
  if (pct < 50) return 'Crítico'
  if (pct < 60) return 'Ruim'
  if (pct < 75) return 'Regular'
  if (pct < 90) return 'Bom'
  return 'Excelente'
}

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
    .select('id, template_id, unit_id, local_id, status, crivo_snapshot')
    .eq('id', id)
    .single()

  if (!execucao) notFound()

  if (execucao.status === 'concluido') {
    redirect(`/crivo/relatorios/${id}`)
  }

  // Mark agendado → em_andamento
  if (execucao.status === 'agendado') {
    await supabase
      .schema('mise')
      .from('checklist_executions')
      .update({ status: 'em_andamento', iniciado_em: new Date().toISOString() })
      .eq('id', id)
  }

  const [{ data: template }, { data: itemsRaw }, { data: respostasRaw }, notaAnteriorResult] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('nome').eq('id', execucao.template_id).single(),
    supabase.schema('mise').from('checklist_template_items')
      .select('id, ordem, titulo, descricao, tipo_resposta, opcoes, peso, requer_comentario, criterio_regramento, requer_foto, topico_ordem, topico_nome, critico').eq('ativo',true)
      .eq('template_id', execucao.template_id)
      .order('ordem'),
    supabase.schema('mise').from('checklist_responses')
      .select('id,item_id,equipamento_id, resposta, comentario, nao_aplicavel, foto_url,orientacao_corretiva,responsavel_orientado')
      .eq('execution_id', id),
    execucao.local_id
      ? supabase.schema('mise').from('checklist_executions')
          .select('percentual, concluido_em')
          .eq('local_id', execucao.local_id)
          .eq('template_id', execucao.template_id)
          .eq('status', 'concluido')
          .neq('id', id)
          .order('concluido_em', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!template) notFound()

  const sourceItems = (execucao.crivo_snapshot?.items ?? itemsRaw ?? []) as NonNullable<typeof itemsRaw>
  const items = sourceItems.map(item => ({
    ...item,
    descricao: item.descricao ?? null,
    requer_comentario: String(item.requer_comentario ?? 'nao'),
    criterio_regramento: (item.criterio_regramento as string | null) ?? null,
    requer_foto: String(item.requer_foto ?? 'nao'),
    topico_ordem: item.topico_ordem ?? null,
    topico_nome: (item.topico_nome as string | null) ?? null,
    critico: item.critico ?? false,
  }))

  const respostas=normalizeEquipmentResponses(sourceItems,respostasRaw??[])
  const photoRows=(respostas?.length ? await supabase.schema('mise').from('crivo_response_fotos').select('id,response_id,url,legenda,ordem').in('response_id',respostas.map(r=>r.id)).order('ordem') : {data:[],error:null});
  if(photoRows.error)throw new Error('Fotos indisponíveis.');
  const initialPhotos=(photoRows.data??[]).map(p=>({...p,item_id:respostas!.find(r=>r.id===p.response_id)!.item_id}));
  const notaAnteriorData = notaAnteriorResult.data
  const notaAnterior = notaAnteriorData?.percentual != null
    ? {
        percentual: notaAnteriorData.percentual as number,
        classificacao: classificar(notaAnteriorData.percentual as number),
        data: (notaAnteriorData.concluido_em as string)?.slice(0, 10) ?? '',
      }
    : undefined

  return (
    <CrivoExecucaoClient
      executionId={id}
      localId={execucao.local_id ?? ''}
      templateNome={template.nome}
      items={items}
      existingRespostas={(respostas ?? []).map(r => ({
        item_id: r.item_id,
        resposta: r.resposta as Record<string, unknown> | null,
        comentario: r.comentario,
        nao_aplicavel: r.nao_aplicavel,
        foto_url: r.foto_url,
      }))}
      initialPhotos={initialPhotos}
      notaAnterior={notaAnterior}
    />
  )
}
