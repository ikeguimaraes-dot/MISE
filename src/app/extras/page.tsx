import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import { ExtrasPreview } from '@/components/extras-evaluation/extras-preview'
import '@/components/extras-evaluation/extras.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Extras · avaliação', robots: { index: false, follow: false } }

export default async function ExtrasEvaluationPage() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'gerente') redirect('/')

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  // Authenticated evaluation only. Simulated roles never grant database privileges.
  return <ExtrasPreview key={session.employeeId} today={today} mode="review" storageScope={session.employeeId} />
}
