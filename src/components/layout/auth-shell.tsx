import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, Flame, Tag, BookOpen } from 'lucide-react'
import { MiseBrand } from './mise-brand'

export function AuthShell({ children, preview = false }: { children: React.ReactNode; preview?: boolean }) {
  return <div className="auth-shell">
    <aside className="auth-story">
      <div className="flex items-center justify-between"><MiseBrand /><span className="section-eyebrow">ORKESTRI OPX</span></div>
      <div className="auth-story-content">
        <span className="hero-overline"><span className="size-1.5 rounded-full bg-ember" /> CADA COISA NO SEU LUGAR</span>
        <h2>Boa operação.<br />Do início <span>ao fim.</span></h2>
        <p>O cuidado com cada detalhe começa aqui.<br />Conecte sua equipe, organize a rotina e mantenha o padrão da casa.</p>
        <div className="auth-pillars"><span><Tag size={16} />Identificar</span><span><ClipboardCheck size={16} />Conferir</span><span><BookOpen size={16} />Registrar</span></div>
      </div>
      <div className="auth-story-footer"><Flame size={20} strokeWidth={1.5} /><p>Consistência é o ingrediente<br />de uma boa experiência.</p><span className="ml-auto text-[10px] text-ink-faint">KPH Participações</span></div>
    </aside>
    <main className="auth-main" id="main-content">
      <div className="auth-mobile-brand"><MiseBrand /><span className="section-eyebrow">ORKESTRI OPX</span></div>
      {preview && <div className="auth-preview-note"><Link href="/preview"><ArrowLeft size={13} />Voltar à central</Link><span>Prévia visual · sem autenticação</span></div>}
      <div className="auth-form-area">{children}</div>
      <p className="auth-footer">MISE · Feito para quem faz acontecer.</p>
    </main>
  </div>
}
