'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, THEME_EVENT, THEME_STORAGE_KEY } from '@/lib/theme'

function subscribe(update: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(event.newValue === 'light' ? 'light' : 'dark')
  }
  window.addEventListener(THEME_EVENT, update)
  window.addEventListener('storage', storage)
  return () => { window.removeEventListener(THEME_EVENT, update); window.removeEventListener('storage', storage) }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', () => 'dark')
  const label = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
  return <button type="button" onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')} className="workspace-icon-button" title={label} aria-label={label}>
    {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
  </button>
}
