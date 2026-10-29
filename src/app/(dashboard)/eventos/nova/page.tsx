import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import EventosClient from '@/components/eventos/eventos-client'

export default async function Page() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role === 'cozinheiro') redirect('/eventos/lista')
  return <EventosClient key="new" role={session.role} page="new" />
}
