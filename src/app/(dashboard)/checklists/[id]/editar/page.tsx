import {ScoringModelSelector} from '@/components/crivo/scoring-model'
import {getMiseSession} from '@/lib/session'
import {redirect} from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditarClient } from './_components/editar-client'

export default async function EditarChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const session=await getMiseSession();if(!session)redirect('/login');if(session.role!=='admin')redirect('/')
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: template }, { data: items }, { data: topicosRaw }] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('id, nome, modulo, scoring_model, ativo').eq('id', id).single(),
    supabase.schema('mise').from('checklist_template_items').select('*').eq('template_id', id).order('ordem'),
    supabase.schema('mise').from('checklist_template_topicos')
      .select('topico_ordem, topico_nome, peso')
      .eq('template_id', id)
      .order('topico_ordem'),
  ])

  if (!template) notFound()

  return (
    <div className="p-6 max-w-3xl">
      <Link href="/checklists" className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Checklists
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Editar checklist</h1>
        <p className="text-sm text-ink-muted mt-1">{template.nome}</p>
      </div>

      {template.modulo==='CRIVO'&&<ScoringModelSelector id={id} model={template.scoring_model} active={template.ativo}/>}
      <EditarClient
        templateId={id}
        modulo={template.modulo ?? ''}
        initialItems={(items ?? []) as Record<string, unknown>[]}
        initialTopicos={(topicosRaw ?? []) as { topico_ordem: number; topico_nome: string | null; peso: unknown }[]}
      />
    </div>
  )
}
