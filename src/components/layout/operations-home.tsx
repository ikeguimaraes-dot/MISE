import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, ClipboardCheck, Clock3, Flame, LayoutDashboard, MoveUpRight, ShieldCheck, Tag } from 'lucide-react'
import { navigationGroups, workspaceHref, type WorkspaceRole } from './navigation'

const modules = [
  { name: 'Etiquetas', eyebrow: 'IDENTIFICAÇÃO', description: 'Da preparação à mesa, tudo identificado.', href: '/etiquetas', icon: Tag, action: 'Emitir etiqueta', color: 'orange' },
  { name: 'Validades', eyebrow: 'SEGURANÇA ALIMENTAR', description: 'O próximo vencimento merece sua atenção.', href: '/validades', icon: Clock3, action: 'Conferir validades', color: 'green' },
  { name: 'Checklists', eyebrow: 'RITMO', description: 'O padrão da casa, em cada detalhe.', href: '/checklists', icon: ClipboardCheck, action: 'Acessar rotinas', color: 'blue' },
  { name: 'Resumo operacional', eyebrow: 'TURNO', description: 'O que aconteceu, registrado para amanhã.', href: '/relatorio-diario', icon: BookOpen, action: 'Preencher resumo', color: 'purple', manager: true },
]

export function OperationsHome({ role, employeeName, preview = false }: { role: WorkspaceRole; employeeName?: string; preview?: boolean }) {
  const manager = role !== 'cozinheiro'
  const firstName = employeeName?.trim().split(' ')[0]
  const today = new Date()
  const date = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
  const day = today.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' })
  const month = today.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')
  const href = (path: string) => workspaceHref(path, preview)
  const routines = [
    { step: '01', title: 'Antes de abrir', text: 'Confira os padrões de abertura.', label: 'Abrir checklists', href: '/checklists', icon: ClipboardCheck },
    { step: '02', title: 'Durante a operação', text: 'Acompanhe os produtos e vencimentos.', label: 'Ver validades', href: '/validades', icon: Clock3 },
    ...(manager ? [{ step: '03', title: 'Ao fechar o turno', text: 'Registre resultados e ocorrências.', label: 'Preencher resumo', href: '/relatorio-diario', icon: BookOpen }] : []),
  ]

  return <div className="operations-home">
    <div className="home-page-heading">
      <div><p className="section-eyebrow mb-2">CENTRAL DE OPERAÇÃO</p><h1>Bom trabalho{firstName ? `, ${firstName}` : ''}<span className="text-ember">.</span></h1><p className="mt-2 text-sm text-ink-subtle">Tudo no lugar para a sua operação acontecer.</p></div>
      <div className="home-date"><CalendarDays size={15} /><span className="capitalize">{date}</span></div>
    </div>

    <section className="home-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <span className="hero-overline"><span className="size-1.5 rounded-full bg-ember" /> DO PRIMEIRO PREPARO AO ÚLTIMO SERVIÇO</span>
        <h2 id="hero-title">Uma boa operação<br />começa <span>nos detalhes.</span></h2>
        <p>Equipe alinhada. Rotina em dia.<br className="sm:hidden" /> Mais espaço para fazer bem-feito.</p>
        <Link href={href('/checklists')} className="workspace-primary-button mt-6">Começar pela rotina <ArrowRight size={16} /></Link>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
        <div className="hero-center"><Image src="/brand/mise-symbol.svg" width={46} height={37} alt="" unoptimized /><span>mise en place</span><small>CADA COISA NO SEU LUGAR</small></div>
        <div className="orbit-label orbit-label-top"><span className="size-6 rounded-full bg-fresh-soft flex items-center justify-center"><Check size={13} className="text-fresh-bright" /></span> Padrão em cada etapa</div>
        <div className="orbit-label orbit-label-bottom"><Tag size={15} className="text-ember" /> Cuidado em cada preparo</div>
        <span className="orbit-dot" />
      </div>
      <span className="hero-corner">MISE / OPERATIONS EXPERIENCE</span>
    </section>

    <div className="home-content-grid">
      <div className="min-w-0">
        <div className="section-heading"><div><h2>No centro da operação</h2><p>As ferramentas que acompanham o seu dia.</p></div><span className="section-eyebrow hidden sm:block">ACESSO RÁPIDO</span></div>
        <div className="home-modules-grid">
          {modules.filter(module => !module.manager || manager).map(module => <Link key={module.href} href={href(module.href)} className={`home-module module-${module.color}`}>
            <div className="flex items-center justify-between"><span className="module-icon"><module.icon size={22} strokeWidth={1.6} /></span><ArrowUpRight size={18} className="module-arrow" /></div>
            <p className="module-eyebrow">{module.eyebrow}</p><h3>{module.name}</h3><p className="module-description">{module.description}</p>
            <span className="module-action">{module.action}<ArrowRight size={14} /></span>
          </Link>)}
        </div>

        {manager && <section className="home-management" aria-labelledby="management-title">
          <div className="section-heading"><div><h2 id="management-title">Um olhar para o todo</h2><p>Acompanhe, entenda e melhore.</p></div></div>
          <div className="management-links">
            <Link href={href('/painel')}><span className="management-icon"><LayoutDashboard size={19} /></span><span><strong>Painel da operação</strong><small>Indicadores e atividade do dia</small></span><ChevronArrow /></Link>
            {role === 'admin' ? <Link href={href('/crivo')}><span className="management-icon"><ShieldCheck size={19} /></span><span><strong>Auditorias CRIVO</strong><small>Qualidade em cada unidade</small></span><ChevronArrow /></Link> : <Link href={href('/relatorios')}><span className="management-icon"><BookOpen size={19} /></span><span><strong>Relatório de produção</strong><small>Histórico e consolidados</small></span><ChevronArrow /></Link>}
          </div>
        </section>}
      </div>

      <aside className="home-routine" aria-label="Guia da rotina diária">
        <div className="routine-header"><span className="section-eyebrow">O SEU DIA, EM ORDEM</span><span className="routine-date"><b>{day}</b><small>{month}</small></span></div>
        <h2>Uma rotina.<br /> Um bom serviço.</h2><p className="routine-intro">Um guia para cada momento<br /> da operação.</p>
        <div className="routine-steps">{routines.map(routine => <div className="routine-step" key={routine.step}><span className="routine-step-number">{routine.step}</span><div><h3>{routine.title}</h3><p>{routine.text}</p><Link href={href(routine.href)}>{routine.label}<ArrowUpRight size={13} /></Link></div></div>)}</div>
        <div className="routine-note"><Flame size={18} strokeWidth={1.5} /><p>Consistência é o ingrediente<br />de uma boa experiência.</p></div>
      </aside>
    </div>

    <section className="upcoming-strip" aria-label="Módulos em desenvolvimento"><div><p className="section-eyebrow">O PRÓXIMO PASSO</p><p className="mt-1 text-xs text-ink-subtle">A operação está crescendo.</p></div><div className="flex flex-wrap gap-2">{navigationGroups.find(group => group.label === 'Em desenvolvimento')?.items.map(item => <span key={item.href} className="upcoming-chip"><item.icon size={14} />{item.label}<small>Em breve</small></span>)}</div></section>
    <footer className="home-footer"><span>MISE <span className="mx-1.5 text-ink-faint">/</span> Orkestri OPX</span><span>Feito para quem faz acontecer.</span></footer>
  </div>
}

function ChevronArrow() { return <MoveUpRight size={16} className="ml-auto shrink-0 text-ink-faint" /> }
