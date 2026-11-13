export type MiseTheme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'mise-theme'
export const THEME_EVENT = 'mise-theme-change'

// Executado no head antes da pintura da página para evitar trocar o fundo após carregar.
export const THEME_BOOTSTRAP = `(function(){var t='dark';try{var s=localStorage.getItem('mise-theme');if(s==='light'||s==='dark')t=s}catch(e){}var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='light'?'#FAF7F2':'#171716')})();`

export function applyTheme(theme: MiseTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#FAF7F2' : '#171716')
  try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* A troca continua funcionando quando o navegador bloqueia armazenamento. */ }
  window.dispatchEvent(new Event(THEME_EVENT))
}
