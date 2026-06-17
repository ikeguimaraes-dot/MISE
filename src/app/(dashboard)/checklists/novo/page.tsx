import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChecklistForm } from './_components/checklist-form'

export default async function NovoChecklistPage() {
  const supabase = createServiceClient()
  const { data: units } = await supabase.from('units').select('id, name').eq('active', true).order('name')

  return (
    <div className="p-6 max-w-5xl">
      <Link
        href="/checklists"
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 mb-6 w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Checklists
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Novo Checklist</h1>
        <p className="text-sm text-neutral-400 mt-1">Crie um checklist operacional para sua equipe</p>
      </div>

      <ChecklistForm units={units ?? []} />
    </div>
  )
}
