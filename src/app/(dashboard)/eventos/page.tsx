import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'

export default async function EventosPage() {
  if (!await getMiseSession()) redirect('/login')

  return <section aria-label="Eventos">
    <div className="mb-4">
      <h1 className="text-2xl font-semibold">Eventos</h1>
      <p className="mt-1 text-sm text-ink-subtle">Ordens de serviço e planejamento. Acesso integrado ao MISE.</p>
    </div>
    <iframe src="/api/eventos/app" title="Sistema de eventos — ordens de serviço"
      className="w-full rounded-xl border border-edge bg-white"
      style={{ height: 'calc(100dvh - 180px)', minHeight: 600 }} />
  </section>
}
