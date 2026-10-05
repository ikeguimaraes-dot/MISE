'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bell, ChevronDown, ChevronRight, Command, LogOut, Menu, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { MiseBrand } from './mise-brand'
import { activeNavigation, canSeeItem, navigationGroups, workspaceHref, type WorkspaceRole } from './navigation'

export function TopNav({ role = 'cozinheiro', isPinUser = false, employeeName, preview = false, previewPath = '/' }: {
  role?: WorkspaceRole; isPinUser?: boolean; employeeName?: string; preview?: boolean; previewPath?: string; hasChecklists?: boolean
}) {
  const pathname = usePathname()
  const path = preview ? previewPath : pathname
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [menuOpen,setMenuOpen]=useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const searchDialog = useRef<HTMLDialogElement>(null)
  const menuDialog = useRef<HTMLDialogElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const active = activeNavigation(path)
  const roleLabel = { admin: 'Administrador', gerente: 'Gerente', cozinheiro: 'Operação' }[role]
  const displayName = employeeName || roleLabel
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('')
  const groups = navigationGroups.map(group => ({ ...group, items: group.items.filter(item => canSeeItem(item, role)) })).filter(group => group.items.length)
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const results = groups.flatMap(group => group.items).filter(item => !item.upcoming && normalize(`${item.label} ${item.description}`).includes(normalize(query)))

  function openSearch() {
    setQuery('')
    searchDialog.current?.showModal()
    searchInput.current?.focus()
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuery('')
        searchDialog.current?.showModal()
        searchInput.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    menuDialog.current?.close()
    searchDialog.current?.close()
  }, [path])

  async function signOut() {
    if (preview || signingOut) return
    setSigningOut(true)
    setLogoutError('')
    try {
      if (isPinUser) {
        const response = await fetch('/api/auth/pin-logout', { method: 'POST' })
        if (!response.ok) throw new Error('logout')
      } else {
        const { error } = await createClient().auth.signOut()
        if (error) throw error
      }
      router.push(isPinUser ? '/pin-login' : '/login')
      router.refresh()
    } catch {
      setLogoutError('Não foi possível sair. Tente novamente.')
      setSigningOut(false)
    }
  }

  function Navigation() {
    return <>
      <Link href={workspaceHref('/', preview)} className="workspace-brand" onClick={() => menuDialog.current?.close()} aria-label="MISE — início">
        <MiseBrand />
        <span className="ml-auto rounded border border-edge-strong px-1.5 py-0.5 text-[9px] font-semibold tracking-[.16em] text-ink-subtle">OPX</span>
      </Link>
      <div className="mx-4 mb-5 flex items-center gap-2.5 rounded-lg border border-edge bg-surface px-3 py-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-surface-raised text-[11px] font-bold text-ink-muted">KPH</span>
        <div><p className="text-xs font-medium text-ink">KPH Participações</p><p className="mt-0.5 text-[10px] text-ink-subtle">Workspace da operação</p></div>
      </div>
      <nav className="workspace-nav" aria-label="Navegação principal">
        {groups.map(group => {
          const content = group.items.map(item => {
            if (item.parent && path !== item.parent && !path.startsWith(`${item.parent}/`)) return null
            const Icon = item.icon
            const selected = active?.href === item.href
            return item.upcoming ? (
              <span key={item.href} className="workspace-nav-item cursor-default text-ink-faint" aria-disabled="true"><Icon size={16} /><span>{item.label}</span><span className="ml-auto text-[9px]">Em breve</span></span>
            ) : (
              <Link key={item.href} href={workspaceHref(item.href, preview)} prefetch={false} onClick={() => menuDialog.current?.close()} aria-current={selected ? 'page' : undefined} className={cn('workspace-nav-item', item.parent && 'workspace-nav-child', selected && 'is-active')}>
                <Icon size={17} strokeWidth={1.7} /><span>{item.label}</span>{selected && <span className="ml-auto size-1.5 rounded-full bg-ember" />}
              </Link>
            )
          })
          return group.label === 'Configurações' || group.label === 'Em desenvolvimento' ? (
            <details key={group.label} className="workspace-nav-group" open={group.items.some(item => item.href === active?.href)}>
              <summary className="workspace-nav-label cursor-pointer list-none"><span>{group.label}</span><ChevronDown size={12} /></summary>{content}
            </details>
          ) : <div key={group.label} className="workspace-nav-group"><p className="workspace-nav-label">{group.label}</p>{content}</div>
        })}
      </nav>
      <div className="workspace-profile">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-surface-raised text-xs font-medium text-ink-muted">{initials}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{displayName}</p><p className="mt-1 text-[10px] text-ink-subtle">{preview ? 'Prévia de layout' : roleLabel}</p></div>
        {!preview && <button type="button" onClick={signOut} disabled={signingOut} aria-label={signingOut ? 'Saindo' : 'Sair da conta'} className="workspace-icon-button"><LogOut size={16} /></button>}
        {logoutError && <p role="alert" className="absolute bottom-20 left-4 right-4 rounded-lg bg-alert-soft p-3 text-xs text-alert-bright">{logoutError}</p>}
      </div>
    </>
  }

  return <>
    <a href="#main-content" className="workspace-skip">Pular para o conteúdo</a>
    <aside className="workspace-sidebar" data-no-print><Navigation /></aside>
    <header className="workspace-topbar" data-no-print>
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" className="workspace-icon-button workspace-menu-trigger" onClick={() => {menuDialog.current?.showModal();setMenuOpen(true)}} aria-label="Abrir menu" aria-haspopup="dialog" aria-controls="workspace-menu" aria-expanded={menuOpen}><Menu size={21} /></button>
        <span className="hidden text-xs text-ink-faint sm:inline">Workspace</span><ChevronRight className="hidden text-ink-faint sm:block" size={13} />
        <span className="truncate text-xs font-medium text-ink-muted">{active?.label ?? 'Operação'}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <button type="button" onClick={openSearch} className="workspace-search-trigger" aria-label="Buscar módulo" aria-haspopup="dialog" aria-controls="workspace-search-dialog"><Search size={15} /><span className="hidden sm:inline">Buscar módulo...</span><kbd className="hidden items-center gap-0.5 rounded border border-edge-strong px-1 py-0.5 text-[10px] md:flex"><Command size={10} /> K</kbd></button>
        {role === 'admin' && <Link href={workspaceHref('/alertas', preview)} className="workspace-icon-button" aria-label="Central de alertas"><Bell size={18} /></Link>}
        <span className="hidden h-5 w-px bg-edge sm:block" />
        <span className="hidden items-center gap-2 text-[10px] text-ink-subtle sm:flex"><span className={cn('size-1.5 rounded-full', preview ? 'bg-warn' : 'bg-ink-muted')} />{preview ? 'Prévia local' : roleLabel}</span>
      </div>
    </header>
    <dialog id="workspace-menu" ref={menuDialog} onClose={()=>setMenuOpen(false)} className="workspace-menu-dialog" aria-label="Menu de navegação" onClick={event => { if (event.target === event.currentTarget) menuDialog.current?.close() }}>
      <button type="button" className="workspace-icon-button absolute right-3 top-3" onClick={() => menuDialog.current?.close()} aria-label="Fechar menu"><X size={18} /></button>
      <div className="flex h-full flex-col pt-7"><Navigation /></div>
    </dialog>
    <dialog id="workspace-search-dialog" ref={searchDialog} className="workspace-search-dialog" aria-labelledby="search-title" onClick={event => { if (event.target === event.currentTarget) searchDialog.current?.close() }}>
      <div className="flex items-center gap-3 border-b border-edge px-5 py-4">
        <Search size={20} className="text-ember" /><label htmlFor="workspace-search" id="search-title" className="sr-only">Buscar módulos da plataforma</label>
        <input id="workspace-search" ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="O que você precisa fazer?" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" autoComplete="off" />
        <button type="button" onClick={() => searchDialog.current?.close()} className="workspace-icon-button" aria-label="Fechar busca"><X size={18} /></button>
      </div>
      <div className="max-h-[55vh] overflow-y-auto p-2">
        {results.length ? results.map(item => <Link key={item.href} href={workspaceHref(item.href, preview)} onClick={() => searchDialog.current?.close()} className="flex items-center gap-3 rounded-lg p-3 hover:bg-surface-raised"><item.icon size={19} className="text-ink-subtle" /><span className="flex-1"><span className="block text-sm text-ink">{item.label}</span><span className="mt-1 block text-xs text-ink-subtle">{item.description}</span></span><ArrowUpRight size={15} className="text-ink-faint" /></Link>) : <p className="p-8 text-center text-sm text-ink-subtle">Nenhum módulo encontrado para “{query}”.</p>}
      </div>
      <p className="border-t border-edge px-5 py-3 text-[10px] text-ink-subtle">Tab para navegar · Enter para abrir · Esc para fechar</p>
    </dialog>
  </>
}
