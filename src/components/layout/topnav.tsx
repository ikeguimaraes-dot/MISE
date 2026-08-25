'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard, Tag, Clock, PackageCheck, ChefHat, ClipboardList, LogOut,
  Package, FolderTree, Printer, Users, KeyRound, FileText, ClipboardCheck, BookOpen, ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type NavEntry = { href: string; label: string; icon: React.ElementType }

const operacionalItems: NavEntry[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/etiquetas', label: 'Etiquetas', icon: Tag },
  { href: '/validades', label: 'Validades', icon: Clock },
  { href: '/recebimento', label: 'Recebimento', icon: PackageCheck },
  { href: '/producao', label: 'Produção', icon: ChefHat },
  { href: '/inventario', label: 'Inventário', icon: ClipboardList },
]

const checklistsItems: NavEntry[] = [
  { href: '/checklists', label: 'Templates', icon: ClipboardCheck },
  { href: '/checklists/historico', label: 'Histórico', icon: ClipboardCheck },
]

const relatoriosItems: NavEntry[] = [
  { href: '/relatorios', label: 'Produção', icon: FileText },
  { href: '/relatorio-diario', label: 'Relatório Diário', icon: BookOpen },
]

const cadastrosItems: NavEntry[] = [
  { href: '/cadastros/funcionarios', label: 'Funcionários', icon: Users },
  { href: '/cadastros/produtos', label: 'Produtos', icon: Package },
  { href: '/cadastros/grupos', label: 'Grupos', icon: FolderTree },
]

const configuracoesItems: NavEntry[] = [
  { href: '/configuracoes/pontos-impressao', label: 'Pontos de Impressão', icon: Printer },
  { href: '/configuracoes/pins', label: 'PINs de Acesso', icon: KeyRound },
]

function isEntryActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(href))
}

function NavLink({ href, label, icon: Icon, pathname }: {
  href: string
  label: string
  icon: React.ElementType
  pathname: string
}) {
  const isActive = isEntryActive(pathname, href)
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-ember-soft text-ember'
          : 'text-ink-subtle hover:text-ink'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

function NavDropdown({ label, icon: Icon, items, pathname }: {
  label: string
  icon: React.ElementType
  items: NavEntry[]
  pathname: string
}) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isActive = items.some(i => isEntryActive(pathname, i.href))

  useEffect(() => {
    if (!open) return

    function updatePosition() {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      setPanelStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left })
    }

    function onOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) setOpen(false)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open])

  return (
    <div className="shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-ember-soft text-ember'
            : 'text-ink-subtle hover:text-ink'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ ...panelStyle, zIndex: 9999 }}
          className="min-w-48 rounded-lg border border-edge bg-surface p-1 shadow-lg"
        >
          {items.map(({ href, label: itemLabel, icon: ItemIcon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isEntryActive(pathname, href)
                  ? 'bg-ember-soft text-ember'
                  : 'text-ink-subtle hover:bg-surface-raised hover:text-ink'
              )}
            >
              <ItemIcon className="h-4 w-4 shrink-0" />
              {itemLabel}
            </Link>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export function TopNav({
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
    <header className="sticky top-0 z-40 border-b border-edge bg-base">
      <div className="flex h-14 items-center gap-1 px-3">
        <Link href="/" className="mr-1 shrink-0">
          <h1 className="text-lg font-bold tracking-tight text-ink">MISE</h1>
        </Link>

        <nav className="scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto">
          {operacionalItems.map(({ href, label, icon }) => (
            <NavLink key={href} href={href} label={label} icon={icon} pathname={pathname} />
          ))}

          {showChecklists && (
            showAdminSections ? (
              <NavDropdown label="Checklists" icon={ClipboardCheck} items={checklistsItems} pathname={pathname} />
            ) : (
              <NavLink href="/checklists" label="Checklists" icon={ClipboardCheck} pathname={pathname} />
            )
          )}

          <NavDropdown label="Relatórios" icon={FileText} items={relatoriosItems} pathname={pathname} />

          {showAdminSections && (
            <>
              <NavDropdown label="Cadastros" icon={Package} items={cadastrosItems} pathname={pathname} />
              <NavDropdown label="Configurações" icon={Printer} items={configuracoesItems} pathname={pathname} />
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sair"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  )
}
