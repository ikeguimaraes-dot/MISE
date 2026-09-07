import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import { OperationsHome } from '@/components/layout/operations-home'

export default async function HomePage() {
  const session = await getMiseSession()
  if (!session) redirect('/pin-login')

  return <OperationsHome role={session.role} employeeName={session.employeeName} />
}
