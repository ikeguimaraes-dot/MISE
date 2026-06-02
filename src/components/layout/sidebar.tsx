'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Tag, Clock, PackageCheck, ChefHat, ClipboardList, LogOut,
  Package, FolderTree, Printer, Users, KeyRound, FileText, ClipboardCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const operacionalItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/etiquetas', label: 'Etiquetas', icon: Tag },
  { href: '/validades', label: 'Validades', icon: Clock },
  { href: '/recebimento', label: 'Recebimento', icon: PackageCheck },
  { href: '/producao', label: 'Produção', icon: ChefHat },
  { href: '/inventario', label: 'Inventário', icon: ClipboardList },
]

const cadastrosItems = [
  { href: '/cadastros/funcionarios', label: 'Funcionários', icon: Users },
  { href: '/cadastros/produtos', label: 'Produtos', icon: Package },
  { href: '/cadastros/grupos', label: 'Grupos', icon: FolderTree },
]

const relatoriosItems = [
  { href: '/relatorios', label: 'Produção', icon: FileText },
]

const configuracoesItems = [
  { href: '/configuracoes/pontos-impressao', label: 'Pontos de Impressão', icon: Printer },
  { href: '/configuracoes/pins', label: 'PINs de Acesso', icon: KeyRound },
]

function NavItem({ href, label, icon: Icon, pathname }: {
  href: string
  label: string
  icon: React.ElementType
  pathname: string
}) {
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-neutral-800 text-white'
          : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

export function Sidebar({
  role = 'admin',
  isPinUser = false,
  hasChecklists = true,
}: {
  role?: 'admin' | 'gerente' | 'cozinheiro'
  isPinUser?: boolean
  hasChecklists?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    if (isPinUser) {
      await fetch('/api/auth/pin-logout', { method: 'POST' })
      router.push('/pin-login')
    } else {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    }
    router.refresh()
  }

  const showAdminSections = role !== 'cozinheiro'
  const showChecklists = role !== 'cozinheiro' || hasChecklists

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-neutral-800 bg-neutral-950 px-3 py-4">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-bold tracking-tight text-white">MISE</h1>
        <p className="text-xs text-neutral-500">Gestão de cozinha</p>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {operacionalItems.map(({ href, label, icon }) => (
            <NavItem key={href} href={href} label={label} icon={icon} pathname={pathname} />
          ))}
        </div>

        {showChecklists && (
          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
              Checklists
            </p>
            <div className="flex flex-col gap-1">
              {showAdminSections ? (
                <>
                  <NavItem href="/checklists" label="Templates" icon={ClipboardCheck} pathname={pathname} />
                  <NavItem href="/checklists/historico" label="Histórico" icon={ClipboardCheck} pathname={pathname} />
                </>
              ) : (
                <NavItem href="/checklists" label="Executar" icon={ClipboardCheck} pathname={pathname} />
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
            Relatórios
          </p>
          <div className="flex flex-col gap-1">
            {relatoriosItems.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} pathname={pathname} />
            ))}
          </div>
        </div>

        {showAdminSections && (
          <>
            <div>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
                Cadastros
              </p>
              <div className="flex flex-col gap-1">
                {cadastrosItems.map(({ href, label, icon }) => (
                  <NavItem key={href} href={href} label={label} icon={icon} pathname={pathname} />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
                Configurações
              </p>
              <div className="flex flex-col gap-1">
                {configuracoesItems.map(({ href, label, icon }) => (
                  <NavItem key={href} href={href} label={label} icon={icon} pathname={pathname} />
                ))}
              </div>
            </div>
          </>
        )}
      </nav>

      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Sair
      </button>
    </aside>
  )
}
