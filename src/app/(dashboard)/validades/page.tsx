import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import { loadValidities } from '@/lib/label-validities-server'
import { ValidadesClient } from './_components/validades-client'

export type { ValidityLabel as LabelRow } from '@/lib/label-validities'
export type UnitOption = { id: string; name: string }

export default async function ValidadesPage() {
  if (!await getMiseSession()) redirect('/login')
  const initialData = await loadValidities({ unit: '', bucket: '', page: 1 })
  return <ValidadesClient initialData={initialData} />
}
