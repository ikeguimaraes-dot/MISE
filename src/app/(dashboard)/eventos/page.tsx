import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import EventosClient from '@/components/eventos/eventos-client'

export default async function EventosPage() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  return <EventosClient role={session.role} />
}
