'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard, Tag, Clock, PackageCheck, ChefHat, ClipboardList, LogOut,
  Package, FolderTree, Printer, Users, KeyRound, FileText, ClipboardCheck, BookOpen,
  ChevronDown, Menu, X, Upload,
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
  { href: '/cadastros/produtos/importar', label: 'Importar produtos', icon: Upload },
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
      setPanelStyle({ position: 'fixed', top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 200) })
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
          className="min-w-48 max-w-[85vw] rounded-lg border border-edge bg-surface p-1 shadow-lg"
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

function DrawerLink({ href, label, icon: Icon, pathname, onClose }: NavEntry & { pathname: string; onClose: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isEntryActive(pathname, href)
          ? 'bg-ember-soft text-ember'
          : 'text-ink-subtle hover:bg-surface-raised hover:text-ink'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

function DrawerSection({ label }: { label: string }) {
  return (
    <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
      {label}
    </p>
  )
}

function MobileDrawer({
  open,
  onClose,
  pathname,
  showAdminSections,
  showChecklists,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  pathname: string
  showAdminSections: boolean
  showChecklists: boolean
  onSignOut: () => void
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Fecha ao trocar de rota
  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Drawer panel */}
      <div className="relative flex w-[85vw] max-w-xs max-h-[100dvh] flex-col bg-base shadow-xl">
        {/* Cabeçalho do drawer */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-edge px-4">
          <span className="text-lg font-bold tracking-tight text-ink">MISE</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex h-10 w-10 items-center justify-center rounded-md text-ink-subtle transition-colors hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Itens de navegação */}
        <nav className="flex-1 overflow-y-auto p-3">
          {operacionalItems.map(item => (
            <DrawerLink key={item.href} {...item} pathname={pathname} onClose={onClose} />
          ))}

          {showChecklists && (
            <>
              <DrawerSection label="Checklists" />
              {showAdminSections
                ? checklistsItems.map(item => (
                    <DrawerLink key={item.href} {...item} pathname={pathname} onClose={onClose} />
                  ))
                : <DrawerLink href="/checklists" label="Executar" icon={ClipboardCheck} pathname={pathname} onClose={onClose} />
              }
            </>
          )}

          <DrawerSection label="Relatórios" />
          {relatoriosItems.map(item => (
            <DrawerLink key={item.href} {...item} pathname={pathname} onClose={onClose} />
          ))}

          {showAdminSections && (
            <>
              <DrawerSection label="Cadastros" />
              {cadastrosItems.map(item => (
                <DrawerLink key={item.href} {...item} pathname={pathname} onClose={onClose} />
              ))}

              <DrawerSection label="Configurações" />
              {configuracoesItems.map(item => (
                <DrawerLink key={item.href} {...item} pathname={pathname} onClose={onClose} />
              ))}
            </>
          )}
        </nav>

        {/* Sair fixo no rodapé */}
        <div className="shrink-0 border-t border-edge p-3">
          <button
            type="button"
            onClick={() => { onClose(); onSignOut() }}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-subtle transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sair
          </button>
        </div>
      </div>
    </div>,
    document.body
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
  const [drawerOpen, setDrawerOpen] = useState(false)

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
    <>
      <header className="sticky top-0 z-40 border-b border-edge bg-base">
        <div className="flex h-14 items-center gap-1 px-3">
          <Link href="/" className="mr-1 shrink-0">
            <h1 className="text-lg font-bold tracking-tight text-ink">MISE</h1>
          </Link>

          {/* Nav horizontal — desktop (≥ md) */}
          <nav className="scrollbar-hide hidden flex-1 items-center gap-1 overflow-x-auto xl:flex">
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

          {/* Espaçador mobile — empurra hambúrguer pra direita */}
          <div className="flex-1 xl:hidden" />

          {/* Botão hambúrguer — mobile (< md) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="flex min-h-11 items-center justify-center rounded-md px-3 text-ink-subtle transition-colors hover:text-ink xl:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Botão Sair — desktop (≥ md) */}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sair"
            className="hidden min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-ink-subtle transition-colors hover:text-ink xl:flex"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sair
          </button>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pathname={pathname}
        showAdminSections={showAdminSections}
        showChecklists={showChecklists}
        onSignOut={handleSignOut}
      />
    </>
  )
}
