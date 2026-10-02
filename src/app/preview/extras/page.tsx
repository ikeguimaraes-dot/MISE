import { notFound } from 'next/navigation'
import { ExtrasPreview } from '@/components/extras-evaluation/extras-preview'
import '@/components/extras-evaluation/extras.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Extras · prévia local', robots: { index: false, follow: false } }

export default function ExtrasPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return <ExtrasPreview today={today} />
}
