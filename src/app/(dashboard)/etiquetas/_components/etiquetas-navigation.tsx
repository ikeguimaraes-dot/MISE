import Link from 'next/link'
import { Building2, MapPin, ArrowLeft, ArrowRight, FolderTree, Package, Plus, Settings2, UserCheck, Users, type LucideIcon } from 'lucide-react'
import { workspaceHref } from '@/components/layout/navigation'

type Card = { title: string; description: string; href: string; icon: LucideIcon }

export function EtiquetasCards({ cards, preview = false }: { cards: Card[]; preview?: boolean }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {cards.map(({ title, description, href, icon: Icon }) => <Link key={href} href={workspaceHref(href, preview)} className="group flex min-h-56 flex-col rounded-2xl border border-edge bg-surface p-6 transition-colors hover:border-ember/50 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember">
      <span className="mb-6 flex size-12 items-center justify-center rounded-xl bg-ember/10 text-ember"><Icon size={24} strokeWidth={1.6} /></span>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{description}</p>
      <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-ember">Acessar <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
    </Link>)}
  </div>
}

export function EtiquetasBack({ href = '/etiquetas', children = 'Voltar para Etiquetas' }: { href?: string; children?: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ember"><ArrowLeft size={15} />{children}</Link>
}

export function EtiquetasHome({ preview = false }: { preview?: boolean }) {
  return <div className="mx-auto max-w-6xl space-y-8 p-6 sm:p-8">
    <div><p className="section-eyebrow mb-2">IDENTIFICAÇÃO E RASTREABILIDADE</p><h1 className="text-2xl font-bold text-ink">Etiquetas</h1><p className="mt-2 text-sm text-ink-muted">Escolha como deseja começar.</p></div>
    <EtiquetasCards preview={preview} cards={[
      { title: 'Nova Etiqueta', description: 'Digite o produto e preencha os dados para emitir uma etiqueta.', href: '/etiquetas/nova', icon: Plus },
      { title: 'Grupos', description: 'Escolha um grupo e encontre os produtos para etiquetar.', href: '/etiquetas/grupos', icon: FolderTree },
      { title: 'Cadastro', description: 'Acesse os cadastros da operação.', href: '/etiquetas/cadastros', icon: Settings2 },
    ]} />
  </div>
}

export function EtiquetasCadastros({ preview = false, canManageCompanies = preview }: { preview?: boolean; canManageCompanies?: boolean }) {
  return <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
    <Link href={workspaceHref('/etiquetas', preview)} className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ember"><ArrowLeft size={15} />Voltar para Etiquetas</Link>
    <div><h1 className="text-2xl font-bold text-ink">Cadastro</h1><p className="mt-2 text-sm text-ink-muted">Organize os produtos e as pessoas da operação.</p></div>
    <EtiquetasCards preview={preview} cards={[
      ...(canManageCompanies ? [{ title: 'Empresas', description: 'Cadastre CNPJ, razão social, endereço e contatos da empresa.', href: '/cadastros/empresas', icon: Building2 },
      { title: 'Unidades da empresa', description: 'Vincule as unidades à empresa e complete os dados de cada local.', href: '/cadastros/unidades', icon: MapPin }] : []),
      { title: 'Grupos', description: 'Cadastre e organize os grupos de produtos.', href: '/cadastros/grupos', icon: FolderTree },
      { title: 'Produtos', description: 'Cadastre produtos e vincule cada um ao seu grupo.', href: '/cadastros/produtos', icon: Package },
      { title: 'Funcionários', description: 'Gerencie a equipe e os acessos à operação.', href: '/cadastros/funcionarios', icon: Users },
      { title: 'Responsáveis', description: 'Cadastre os responsáveis pelas etiquetas.', href: '/cadastros/responsaveis', icon: UserCheck },
    ]} />
  </div>
}
