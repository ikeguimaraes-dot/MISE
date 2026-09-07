import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Database, Info } from 'lucide-react'
import { TopNav } from '@/components/layout/topnav'
import { OperationsHome } from '@/components/layout/operations-home'
import { activeNavigation } from '@/components/layout/navigation'
import { DashboardClient } from '@/app/(dashboard)/_components/dashboard-client'
import type { KpiItem, LabelGroup } from '@/app/(dashboard)/painel/page'
import { AuthShell } from '@/components/layout/auth-shell'
import { LoginForm } from '@/components/auth/login-form'
import { PinLoginClient } from '@/app/pin-login/_components/pin-login-client'

export const dynamic = 'force-dynamic'

// Local visual review only. Never supplies an authentication session or accesses the database.
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ module?: string; unit?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { module: requestedModule = '/', unit = '' } = await searchParams
  if (requestedModule === 'login') return <AuthShell preview><LoginForm preview /></AuthShell>
  if (requestedModule === 'pin-login') return <PinLoginClient preview employees={[
    { id: 'preview-ana', nome: 'Ana · exemplo' },
    { id: 'preview-bruno', nome: 'Bruno · exemplo' },
    { id: 'preview-carla', nome: 'Carla · exemplo' },
    { id: 'preview-diego', nome: 'Diego · exemplo' },
    { id: 'preview-elisa', nome: 'Elisa · exemplo' },
    { id: 'preview-felipe', nome: 'Felipe · exemplo' },
  ]} />
  const active = activeNavigation(requestedModule)
  if (!active) notFound()
  const path = active.href
  const now = Date.now()
  const units = [{ id: 'demo-meet', name: 'Meet & Eat · demonstração' }, { id: 'demo-match', name: 'Match Point · demonstração' }]
  const sampleLabels: KpiItem[] = [
    { id: 'demo-1', nome: 'Molho de tomate artesanal', unit_name: units[0].name, employee_name: 'Equipe de cozinha', data_manipulacao: new Date(now - 3600000).toISOString(), validade: new Date(now + 7200000).toISOString(), status: 'ativa' },
    { id: 'demo-2', nome: 'Legumes porcionados', unit_name: units[0].name, employee_name: 'Equipe de cozinha', data_manipulacao: new Date(now - 5400000).toISOString(), validade: new Date(now + 18000000).toISOString(), status: 'ativa' },
    { id: 'demo-3', nome: 'Caldo de legumes', unit_name: units[1].name, employee_name: 'Equipe de cozinha', data_manipulacao: new Date(now - 7200000).toISOString(), validade: new Date(now + 43200000).toISOString(), status: 'ativa' },
  ]
  const currentUnit = units.some(item => item.id === unit) ? unit : ''
  const labels = sampleLabels.filter(item => !currentUnit || item.unit_name === units.find(value => value.id === currentUnit)?.name)
  const groups: LabelGroup[] = labels.map(item => ({ key: item.id, nome: item.nome, unit_name: item.unit_name, status: 'ativa', count: 1, items: [item] }))

  return <div className="min-h-screen bg-base">
    <TopNav role="admin" employeeName="Equipe KPH" preview previewPath={path} />
    <main id="main-content" tabIndex={-1} className="workspace-main">
      <div className="preview-banner"><span className="flex items-center gap-2"><Info size={13} />Prévia de layout · ambiente local</span><span>{path === '/painel' ? 'Dados demonstrativos, sem conexão com a operação.' : 'Os módulos com dados dependem da configuração do banco.'}</span><span className="flex flex-wrap gap-4"><Link href="/preview?module=login" className="underline underline-offset-4">Telas de acesso</Link><Link href="/preview/brand" className="underline underline-offset-4">Identidade visual</Link></span></div>
      {path === '/' ? <OperationsHome role="admin" preview /> : path === '/painel' ? <DashboardClient units={units} currentUnit={currentUnit} kpiEtiquetasHoje={labels} kpiCriticas={labels} kpiProducoes={[]} kpiDescartes={[]} labelGroups={groups} preview /> : (
        <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
          <Link href="/preview" className="mb-9 inline-flex items-center gap-2 text-xs text-ink-subtle hover:text-ember"><ArrowLeft size={14} />Voltar ao início</Link>
          <span className="mb-5 flex size-14 items-center justify-center rounded-xl border border-edge bg-surface text-ember"><active.icon size={26} strokeWidth={1.5} /></span>
          <p className="section-eyebrow mb-3">PRÉVIA DO WORKSPACE</p><h1 className="text-3xl font-medium tracking-tight">{active.label}</h1><p className="mt-3 text-sm text-ink-subtle">{active.description}</p>
          <div className="mt-9 rounded-xl border border-edge bg-surface p-6"><div className="flex items-center gap-3"><Database size={19} className="text-warn" /><h2 className="text-sm font-medium">Este módulo utiliza dados da operação</h2></div><p className="mt-4 text-sm leading-7 text-ink-subtle">A nova navegação já está aplicada a este módulo. Para carregar seus registros e formulários, é necessário configurar as credenciais locais do Supabase. A prévia permite explorar a página inicial e o painel com dados demonstrativos.</p><Link href="/preview?module=%2Fpainel" className="workspace-primary-button mt-6">Explorar painel de exemplo<ArrowRight size={15} /></Link></div>
        </div>
      )}
    </main>
  </div>
}
