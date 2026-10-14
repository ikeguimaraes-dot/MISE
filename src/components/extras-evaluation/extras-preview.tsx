'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleAlert, ClipboardList, FileCheck2, History, LayoutDashboard, Plus, Printer, RotateCcw, ShieldCheck, Users, Wallet, X } from 'lucide-react'
import { actionsFor, isActive, LABELS, money, nextOwner, parseMoney, ROLES, samples, SECTORS, STATUS, total, transition, upgradePreview, type Action, type Extra, type Role } from './model'

import { calcWeeklyBudget, requestRoute, validDate, weekDays, type WeeklyBudget } from '../../lib/extras/alcada'
import { DEMO_UNITS, useWeeklyBudget, budgetWithSimulation, WeeklyBudgetCard, type BudgetUnit } from './weekly-budget'

const STORAGE = 'mise-extras-local-preview-v1'
type View = 'aprovacoes' | 'solicitacoes' | 'minha-fila' | 'caixa' | 'relatorios'
type Modal = { kind: 'new' } | { kind: 'action'; id: string; action: Action } | { kind: 'reset' } | null
const formMoney = (n: number) => (n / 100).toFixed(2).replace('.', ',')
const dateLabel = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

export function ExtrasPreview({ today, mode = 'local', storageScope = 'local', units = DEMO_UNITS, initialUnit, initialDay }: { today: string; mode?: 'local' | 'review'; storageScope?: string; units?: BudgetUnit[]; initialUnit?: string; initialDay?: string }) {
  const storageKey = mode === 'local' ? STORAGE : `mise-extras-review-v2-${storageScope}`
  const homeHref = mode === 'local' ? '/preview' : '/'
  const reviewLabel = mode === 'local' ? 'PRÉVIA LOCAL' : 'VERSÃO DE AVALIAÇÃO'
  const [items, setItems] = useState<Extra[]>(() => samples(today, true).filter(item => units.some(unit => unit.name === item.unit)))
  const [role, setRole] = useState<Role>('Líder')
  const [view, setView] = useState<View>('solicitacoes')
  const [unit, setUnit] = useState(initialUnit ?? units[0]?.name ?? '')
  const [day, setDay] = useState(initialDay ?? today)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('EX-101')
  const [modal, setModal] = useState<Modal>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [emergency, setEmergency] = useState(false)
  const [draftUnit, setDraftUnit] = useState(initialUnit ?? units[0]?.name ?? '')
  const [draftDay, setDraftDay] = useState(initialDay ?? today)
  const [draftValue, setDraftValue] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const [ready, setReady] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const detailPanel = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLElement | null>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if ((saved?.version === 1 || saved?.version === 2 || saved?.version === 3 || saved?.version === 4) && Array.isArray(saved.items) && saved.items.every((item: Extra) => typeof item.id === 'string' && typeof item.day === 'string' && typeof item.name === 'string' && typeof item.sector === 'string' && typeof item.value === 'number' && (item.status in STATUS || (item.status as string) === 'aprovado_rh') && Array.isArray(item.history))) setItems(upgradePreview(saved.items, saved.version))
    } catch { setNotice('O navegador não restaurou os testes anteriores. Os exemplos estão disponíveis.') }
    setReady(true)
  }, [storageKey])
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 4, items })) }
    catch { setNotice('Armazenamento indisponível: os testes serão mantidos somente enquanto esta página estiver aberta.') }
  }, [items, ready, storageKey])
  useEffect(() => { if (modal) dialog.current?.showModal() }, [modal])

  function openModal(next: Modal) { trigger.current = document.activeElement as HTMLElement; setError(''); setEmergency(false); setDraftUnit(unit === 'Todas as unidades' ? units[0]?.name ?? '' : unit); setDraftDay(day); setDraftValue(''); setModal(next) }
  function closeModal() { dialog.current?.close(); setModal(null); trigger.current?.focus() }
  function selectItem(id: string) {
    setSelectedId(id)
    if (window.matchMedia('(max-width: 650px)').matches) {
      requestAnimationFrame(() => {
        detailPanel.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
        detailPanel.current?.focus({ preventScroll: true })
      })
    }
  }
  const scoped = items.filter(item => units.some(unit => unit.name === item.unit) && (unit === 'Todas as unidades' || item.unit === unit) && (view === 'relatorios' ? item.day.slice(0, 7) === day.slice(0, 7) : item.day === day))
  const active = scoped.filter(isActive)
  const approvals = active.filter(item => actionsFor(item, 'Diretor de Operação').some(action => action === 'aprovar_operacao' || action === 'aprovar_emergencia'))
  const pending = active.filter(item => actionsFor(item, role).length > 0)
  const visible = scoped.filter(item => {
    if (view === 'aprovacoes' && !approvals.some(approval => approval.id === item.id)) return false
    if (view === 'minha-fila' && !actionsFor(item, role).length) return false
    if (view === 'caixa' && !(item.payer === 'Casa' && (item.status === 'reservado' || item.emergency && (item.workflow === 'weekly' || item.emergencyApproved) && ['solicitado', 'aprovado_rh', 'aprovado_operacao'].includes(item.status)))) return false
    const haystack = `${item.id} ${item.name} ${item.sector} ${item.job} ${STATUS[item.status]}`.toLocaleLowerCase('pt-BR')
    return haystack.includes(query.toLocaleLowerCase('pt-BR'))
  })
  const selected = visible.find(item => item.id === selectedId) ?? visible[0]
  const actionItem = modal?.kind === 'action' ? items.find(item => item.id === modal.id) : undefined
  const action = modal?.kind === 'action' ? modal.action : undefined
  const editingRh = action === 'preparar_rh' || action === 'regularizar'
  const amount = active.reduce((sum, item) => sum + total(item), 0)
  const settled = active.filter(item => item.status === 'pago').reduce((sum, item) => sum + total(item), 0)
  const reported = active.filter(item => item.status === 'informado').reduce((sum, item) => sum + total(item), 0)
  const emergencyPending = active.filter(item => item.emergency && !item.receipt)
  const aged = active.filter(item => ['aprovado_operacao', 'reservado'].includes(item.status) && new Date(`${today}T23:59:59-03:00`).getTime() - new Date(item.stageAt).getTime() > 7 * 86400000)
  const canCreate = role === 'Líder' || role === 'Caixa'

  const mainSource = useWeeklyBudget(units.find(row => row.name === unit), day, mode)
  const draftSource = useWeeklyBudget(units.find(row => row.name === draftUnit), validDate(draftDay) ? draftDay : '', mode)
  const actionSource = useWeeklyBudget(units.find(row => row.name === (actionItem?.unit ?? unit)), actionItem?.day ?? day, mode)
  function projection(base: WeeklyBudget | undefined, name: string, reference: string, exclude?: string) {
    const days = weekDays(reference)
    const simulated = items.filter(item => item.unit === name && item.id !== exclude && item.day >= days[0] && item.day <= days[6] && isActive(item)).reduce((sum, item) => sum + total(item), 0)
    return budgetWithSimulation(base ?? calcWeeklyBudget(name, reference, { metas: [], overrides: [], configs: [], extras: [] }), simulated)
  }
  const mainBudget = mainSource.budget ? projection(mainSource.budget, unit, day) : undefined
  const draftAmount = parseMoney(draftValue)
  const draftBudget = validDate(draftDay) ? projection(draftSource.budget, draftUnit, draftDay) : undefined
  const draftRoute = draftBudget && Number.isSafeInteger(draftAmount) && draftAmount > 0 ? requestRoute(draftBudget, draftAmount, emergency || role === 'Caixa') : undefined
  const overdue = items.filter(item => units.some(unit => unit.name === item.unit) && item.status === 'aguardando_diretoria' && clock - Date.parse(item.stageAt) > 86400000)

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!canCreate) { setError('Selecione Líder ou Caixa para abrir uma solicitação.'); return }
    const data = new FormData(event.currentTarget)
    const get = (key: string) => String(data.get(key) ?? '').trim()
    const urgent = emergency || role === 'Caixa'
    const value = parseMoney(get('value'))
    if ((urgent && !get('name')) || !Number.isSafeInteger(value) || value <= 0) { setError('Preencha recebedor de exemplo, valor positivo.'); return }
    if (!get('job') || !get('detail')) { setError('Informe função e contexto da solicitação.'); return }
    if (!validDate(get('day')) || !units.some(unit => unit.name === get('unit'))) { setError('Selecione uma data válida e uma unidade disponível.'); return }
    const route = requestRoute(projection(draftSource.budget, get('unit'), get('day')), value, urgent)
    const at = new Date().toISOString()
    const id = `EX-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
    const item: Extra = { workflow: 'weekly', excess: draftSource.budget ? route.excesso : undefined, id, unit: get('unit'), day: get('day'), period: get('period'), sector: get('sector'), job: get('job'), reason: get('reason'), detail: get('detail'), requester: `${role} · demonstração`, name: get('name'), value, payer: 'Casa', identityChecked: false, emergency: urgent, emergencyApproved: false, rhComplete: false, receipt: false, status: route.status, stageAt: at, history: [{ at, actor: role, text: urgent ? 'Emergência registrada · alerta imediato à diretoria (simulação)' : route.status === 'aguardando_diretoria' ? (draftSource.budget ? `Enviada à diretoria · excesso projetado ${money(route.excesso)}` : 'Enviada à diretoria · alçada indisponível na consulta') : 'Solicitação dentro da alçada · enviada ao RH' }] }
    setItems(previous => [item, ...previous]); setSelectedId(id); setDay(item.day); setUnit(item.unit); setQuery(''); setView('solicitacoes'); setNotice(`${id} criada. ${urgent ? 'Exceção emergencial registrada; alerta demonstrativo à diretoria disponível nesta tela.' : route.status === 'aguardando_diretoria' ? 'Aguardando diretoria antes do RH.' : 'Dentro da alçada. O RH pode analisar agora.'}`); closeModal()
  }

  function applyAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!actionItem || !action) return
    const data = new FormData(event.currentTarget)
    const patch: Partial<Extra> = editingRh ? { name: String(data.get('name') ?? ''), value: action === 'regularizar' || actionItem.emergencyApproved ? actionItem.value : parseMoney(String(data.get('value') ?? '')), payer: action === 'regularizar' || actionItem.emergencyApproved ? actionItem.payer : data.get('payer') as 'Casa' | 'Estaff', identityChecked: data.has('identity') } : { receipt: data.has('receipt') }
    try {
      const updated = transition(actionItem, role, action, patch, String(data.get('note') ?? ''), new Date().toISOString(), projection(actionSource.budget, actionItem.unit, actionItem.day, actionItem.id))
      if (updated.workflow === 'weekly' && action === 'preparar_rh' && !actionSource.budget && updated.status === 'aguardando_diretoria') {
        updated.excess = undefined
        updated.history[updated.history.length - 1].text += ' — consulta de alçada indisponível; análise da diretoria necessária'
      }
      setItems(previous => previous.map(item => item.id === updated.id ? updated : item))
      setNotice(`${updated.id}: ${STATUS[updated.status]}. ${nextOwner(updated)}.`)
      closeModal()
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir esta etapa.') }
  }

  return <div className="ex-app">
    <a className="ex-skip" href="#extras-content">Pular para solicitações</a>
    <div className="ex-preview"><span><span className="ex-dot" />{reviewLabel} · DADOS DEMONSTRATIVOS</span><span>Testes salvos neste navegador. Use dados fictícios. Não efetua pagamentos nem envia solicitações reais.</span><button onClick={() => openModal({ kind: 'reset' })}><RotateCcw size={13} />Reiniciar exemplos</button></div>
    <header className="ex-header"><Link href={homeHref} aria-label="MISE — início"><Image src="/brand/mise-logo-light.svg" alt="MISE" width={100} height={36} unoptimized /></Link><span className="ex-breadcrumb">Operação <ChevronRight size={13} /> Extras</span><label className="ex-role"><span>Simular papel</span><select value={role} onChange={event => { setRole(event.target.value as Role); setNotice('Papel de teste alterado. As ações disponíveis acompanham a etapa de cada solicitação.') }}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></label></header>
    <div className="ex-layout">
      <aside className="ex-nav"><div className="ex-nav-title">CONTROLE DE EXTRAS</div>{([{ key: 'solicitacoes', title: 'Solicitações', icon: ClipboardList }, { key: 'aprovacoes', title: 'Aprovações', icon: ShieldCheck }, { key: 'minha-fila', title: 'Minha fila', icon: Users }, { key: 'caixa', title: 'Envio ao caixa', icon: Wallet }, { key: 'relatorios', title: 'Custos por setor', icon: LayoutDashboard }] as const).map(tab => <button key={tab.key} onClick={() => { setView(tab.key); setQuery('') }} aria-current={view === tab.key ? 'page' : undefined}><tab.icon size={17} />{tab.title}{tab.key === 'minha-fila' && <span>{pending.length}</span>}{tab.key === 'aprovacoes' && <span>{approvals.length}</span>}</button>)}<div className="ex-nav-note"><ShieldCheck size={20} /><p>Solicitar, aprovar,<br />pagar e conferir.</p><small>Cada etapa tem um responsável. Cada decisão deixa um registro.</small></div><Link href={homeHref}><ArrowLeft size={15} />{mode === 'local' ? 'Voltar à prévia do MISE' : 'Voltar à plataforma'}</Link></aside>
      <main id="extras-content" className="ex-main">
        <div className="ex-heading"><div><span className="ex-eyebrow">PESSOAS CERTAS. CONTROLE EM CADA ETAPA.</span><h1>{view === 'aprovacoes' ? 'Aprovações da Operação.' : view === 'relatorios' ? 'O custo, por inteiro.' : view === 'caixa' ? 'Pronto para o caixa.' : view === 'minha-fila' ? 'O próximo passo é seu.' : 'Extras, em ordem.'}</h1><p>{view === 'aprovacoes' ? 'O Diretor de Operação aprova ou recusa. Selecione a solicitação e registre sua decisão no painel da direita.' : view === 'relatorios' ? 'Uma visão mensal do custo registrado, do desembolso informado e do pagamento conferido.' : view === 'caixa' ? 'Pagamentos da casa liberados pelo Financeiro e exceções emergenciais sinalizadas à diretoria.' : view === 'minha-fila' ? `Solicitações que aguardam uma ação de ${role}.` : 'Da solicitação à conferência. O grupo e a planilha dão lugar a um fluxo que você acompanha.'}</p></div><div className="ex-heading-actions">{canCreate && <button className="ex-primary" disabled={!ready} onClick={() => openModal({ kind: 'new' })}><Plus size={17} />{role === 'Caixa' ? 'Solicitar emergência' : 'Solicitar extra'}</button>}{view === 'caixa' && <button className="ex-secondary" onClick={() => window.print()}><Printer size={16} />Imprimir lista</button>}</div></div>
        <div className="ex-filters"><label>Unidade<select value={unit} onChange={e => setUnit(e.target.value)}>{['Todas as unidades', ...units.map(unit => unit.name)].map(u => <option key={u}>{u}</option>)}</select></label><label>{view === 'relatorios' ? 'Mês de trabalho' : 'Data de trabalho'}<input aria-label={view === 'relatorios' ? 'Mês de trabalho' : 'Data de trabalho'} type={view === 'relatorios' ? 'month' : 'date'} value={view === 'relatorios' ? day.slice(0, 7) : day} onChange={e => { if (e.target.value) setDay(view === 'relatorios' ? `${e.target.value}-01` : e.target.value) }} /></label><span className="ex-scope">{view === 'relatorios' ? 'Visão mensal' : 'Visão do dia'} · {active.length} solicitações ativas</span></div>
        <WeeklyBudgetCard budget={mainBudget} realSpend={mainSource.budget?.gasto ?? 0} unit={unit} loading={mainSource.loading} error={mainSource.error} retry={mainSource.retry} local={mode === 'local'} />
        {overdue.length > 0 && <div className="ex-alert" role="status"><CircleAlert size={18} /><div><b>Crítico · {overdue.length} solicitação(ões) aguardando diretoria há mais de 24h</b>{overdue.map(item => <button className="ex-secondary" key={item.id} onClick={() => { setDay(item.day); setUnit(item.unit); setView('aprovacoes'); setSelectedId(item.id) }}>{item.id} · {item.unit} · abrir decisão</button>)}</div></div>}
        <div className="ex-metrics"><article><span>Custo registrado</span><strong>{money(amount)}</strong><small>{active.filter(i => total(i) === 0).length} solicitação(ões) ainda sem valor</small></article><article><span>Aguardando sua ação</span><strong>{String(pending.length).padStart(2, '0')}<Users size={21} /></strong><small>Etapas disponíveis para {role}</small></article><article><span>Pagamento informado</span><strong>{money(reported)}</strong><small>Desembolso aguardando conferência</small></article><article><span>Pago e conferido</span><strong>{money(settled)}</strong><small>Encerrado pelo Financeiro</small></article></div>
        {(emergencyPending.length > 0 || aged.length > 0) && <div className="ex-alert"><CircleAlert size={18} /><p>{emergencyPending.length > 0 && <span><b>{emergencyPending.length} emergência(s)</b> sinalizada(s) à diretoria nesta avaliação. </span>}{aged.length > 0 && <span><b>{aged.length} liberação(ões)</b> aguardando há mais de sete dias. </span>}Os alertas desta prévia aparecem apenas nesta tela.</p></div>}
        <div className="ex-approval-guide"><ShieldCheck size={19} /><div><b>Acima da alçada: Diretor de Operação.</b><p>Dentro da alçada → RH. Acima → Diretoria antes do RH. Depois: Financeiro libera → Caixa informa → Financeiro confere. Emergência segue como exceção sinalizada.</p></div><button className="ex-secondary" onClick={() => { setView('aprovacoes'); setQuery(''); }}>Abrir aprovações <ArrowRight size={15} /></button></div>
        <p className="ex-notice" role="status" aria-live="polite">{notice || 'Comece por uma solicitação e troque o papel no topo para testar a próxima etapa.'}</p>

        {view === 'relatorios' ? <div className="ex-report"><div className="ex-section-title"><div><h2>Onde o custo se concentra</h2><p>Registros ativos pela data do trabalho. Recusados e cancelados ficam fora da soma.</p></div><span>EXEMPLOS · SEM HISTÓRICO IMPORTADO</span></div><div className="ex-report-table"><table><thead><tr><th>Setor</th><th>Solicitações</th><th>Custo registrado</th><th>Participação no custo</th></tr></thead><tbody>{SECTORS.map(sector => { const group = active.filter(i => i.sector === sector); const sum = group.reduce((s, i) => s + total(i), 0); return <tr key={sector}><th scope="row">{sector}</th><td>{group.length}</td><td>{money(sum)}</td><td><div className="ex-bar"><span style={{ width: `${amount ? sum / amount * 100 : 0}%` }} /></div><small>{amount ? (sum / amount * 100).toFixed(1) : '0'}%</small></td></tr> })}</tbody></table></div><div className="ex-report-note"><CircleAlert size={19} /><p><b>Faturamento ainda não conectado.</b> O percentual sobre vendas e seu alerta ficam indisponíveis nesta prévia. Solicitações não equivalem a pessoas únicas, e concentração por setor não comprova falha de escala.</p></div></div> : <div className="ex-workspace">
          <section className="ex-list" aria-label="Solicitações de extras"><div className="ex-list-heading"><div><h2>{view === 'aprovacoes' ? 'Aguardando aprovação do Diretor' : view === 'caixa' ? 'Lista do dia · Casa' : 'Acompanhar solicitações'}</h2><small>{visible.length} registro(s) · {view === 'caixa' ? 'Estaff segue com Financeiro' : 'selecione para ver as etapas'}</small></div><label><span className="ex-sr">Buscar solicitações</span><input type="search" placeholder="Buscar nome, setor ou etapa…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
            {!visible.length && <div className="ex-empty"><ClipboardList size={30} /><h3>{view === 'minha-fila' ? 'Tudo em dia por aqui.' : 'Nenhuma solicitação nesta seleção.'}</h3><p>{view === 'minha-fila' ? 'Troque o papel no topo ou acompanhe todas as solicitações.' : 'Ajuste os filtros ou crie uma solicitação de exemplo.'}</p><button className="ex-secondary" onClick={() => { setView('solicitacoes'); setUnit('Todas as unidades'); setDay(today); setQuery('') }}>Ver exemplos do dia</button></div>}
            {visible.map(item => <button className={`ex-row ${selected?.id === item.id ? 'is-selected' : ''}`} key={item.id} onClick={() => selectItem(item.id)} aria-pressed={selected?.id === item.id}><div className="ex-row-top"><span className="ex-id">{item.id}{selected?.id === item.id && <span className="ex-selected-label"> · SELECIONADO</span>}</span><span className={`ex-badge ${item.status === 'pago' ? 'is-paid' : ''}`}>{STATUS[item.status]}</span>{item.emergency && <span className="ex-urgent">Emergencial</span>}</div><div className="ex-row-body"><div><h3>{item.name || item.job}</h3><p>{item.sector} · {item.unit}</p></div><strong>{total(item) ? money(total(item)) : 'A definir'}</strong></div><div className="ex-row-bottom"><span>{dateLabel(item.day)} · {item.period}</span><span>{nextOwner(item)} <ArrowRight size={12} /></span></div></button>)}
          </section>
          <aside ref={detailPanel} tabIndex={-1} className="ex-detail" aria-label="Detalhes da solicitação">{selected ? <><div className="ex-detail-heading"><span className="ex-eyebrow">{selected.id} / SOLICITAÇÃO SELECIONADA</span><span className="ex-pill">{selected.payer}</span></div><h2>{selected.name || 'Pessoa a definir pelo RH'}</h2>{selected.workflow !== 'weekly' && <p className="ex-context">Teste salvo no fluxo anterior à alçada. Histórico preservado; novas solicitações usam a regra semanal.</p>}<p className="ex-detail-job">{selected.job} · {selected.sector}</p><dl><div><dt>Solicitante</dt><dd>{selected.requester}</dd></div><div><dt>Motivo</dt><dd>{selected.reason}</dd></div><div><dt>Trabalho</dt><dd>{dateLabel(selected.day)} · {selected.period}</dd></div><div><dt>Identificação</dt><dd>{selected.identityChecked ? 'Conferida · exemplo sem CPF real' : 'A completar pelo RH'}</dd></div></dl><p className="ex-context">{selected.detail}</p><div className="ex-total"><div><span>Diária {money(selected.value)}</span></div><strong>{total(selected) ? money(total(selected)) : 'Valor a definir'}</strong></div>
          {selected.emergency && <div className="ex-emergency-note"><ShieldCheck size={18} /><p>{selected.workflow === 'weekly' ? 'Exceção emergencial: pagamento demonstrativo permitido mesmo acima da alçada. Alerta à diretoria disponível nesta avaliação; nenhuma mensagem real é enviada.' : selected.emergencyApproved ? 'Emergência autorizada previamente pelo Diretor de Operação. Aprovação registrada no histórico.' : 'Pagamento bloqueado até a autorização prévia do Diretor de Operação.'}</p></div>}
          {selected.receipt && <div className="ex-receipt"><FileCheck2 size={21} /><div><b>Recibo demonstrativo anexado</b><p>Exemplo de comprovante · sem arquivo ou assinatura real</p></div></div>}
          <div className="ex-next"><span>{approvals.some(item => item.id === selected.id) ? 'DECISÃO DO DIRETOR DE OPERAÇÃO' : 'PRÓXIMA ETAPA'}</span><h3>{nextOwner(selected)}</h3>{approvals.some(item => item.id === selected.id) && role !== 'Diretor de Operação' && <div className="ex-approval-help"><p>A aprovação acontece aqui. Nesta prévia, assuma o papel do Diretor para liberar os botões de decisão.</p><button className="ex-primary" onClick={() => { setRole('Diretor de Operação'); setNotice('Simulação do Diretor de Operação ativa. Use Aprovar solicitação ou Aprovar emergência no painel de detalhes.'); }}><ShieldCheck size={16} />Simular Diretor de Operação</button></div>}{selected.status === 'aguardando_diretoria' && <p>{selected.excess === undefined ? 'Pedido encaminhado à diretoria; excesso não apurado neste registro.' : `Excesso projetado no encaminhamento: ${money(selected.excess)}.`} A decisão da diretoria libera o cadastro para o RH.</p>}{selected.status === 'solicitado' && !selected.emergency && <p>O RH completa o cadastro e confirma valor e pagadora. Aumento do valor exige nova conferência da alçada.</p>}{actionsFor(selected, role).length ? <div className="ex-actions">{actionsFor(selected, role).map((a, idx) => <button key={a} className={idx === 0 && a !== 'cancelar' ? 'ex-primary' : 'ex-secondary'} onClick={() => openModal({ kind: 'action', id: selected.id, action: a })}>{LABELS[a]}{idx === 0 && <ArrowRight size={15} />}</button>)}</div> : <p>{selected.status === 'pago' || !isActive(selected) ? 'Histórico preservado. Nenhuma ação pendente.' : `Nenhuma ação para ${role} nesta etapa. Use o seletor de papel para continuar o teste.`}</p>}</div>
          <div className="ex-history"><h3><History size={16} />Histórico do processo</h3><ol>{selected.history.map((event, index) => <li key={`${event.at}-${index}`}><span className="ex-history-dot" /><div><b>{event.text}</b><small>{event.actor} · {new Date(event.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div></li>)}</ol></div></> : <div className="ex-empty"><Users size={25} /><p>Os detalhes aparecem ao selecionar uma solicitação.</p></div>}</aside>
        </div>}
        <footer className="ex-footer"><span>MISE · Preparar. Organizar. Servir.</span><span>Prévia funcional · os papéis são simulações, não permissões de produção.</span></footer>
      </main>
    </div>

    <dialog ref={dialog} className="ex-dialog" aria-labelledby="ex-dialog-title" onCancel={() => { setModal(null); trigger.current?.focus() }} onClose={() => setModal(null)}>
      {modal && <><button type="button" className="ex-dialog-close" aria-label="Fechar" onClick={closeModal}><X size={20} /></button><span className="ex-eyebrow">{role.toUpperCase()} · SIMULAÇÃO</span><h2 id="ex-dialog-title">{modal.kind === 'new' ? 'Uma nova solicitação.' : modal.kind === 'reset' ? 'Recomeçar os testes?' : action ? LABELS[action] : ''}</h2>
      {modal.kind === 'reset' ? <><p>Os registros desta prévia salvos neste navegador serão substituídos pelos exemplos iniciais das unidades disponíveis.</p><div className="ex-actions"><button className="ex-secondary" onClick={closeModal}>Manter meus testes</button><button className="ex-primary" onClick={() => { setItems(samples(today, true).filter(item => units.some(unit => unit.name === item.unit))); setDay(today); setUnit(units[0]?.name ?? ''); setView('solicitacoes'); setSelectedId('EX-101'); setQuery(''); setRole('Líder'); setNotice('Exemplos restaurados.'); closeModal() }}>Reiniciar exemplos</button></div></> : modal.kind === 'new' ? <form onSubmit={createRequest} onChange={event => { const form = new FormData(event.currentTarget); setDraftUnit(String(form.get('unit') ?? '')); setDraftDay(String(form.get('day') ?? '')); setDraftValue(String(form.get('value') ?? '')) }}><p>Use dados fictícios. O RH completa o cadastro no fluxo normal.</p><div className="ex-form-grid"><label>Unidade<select name="unit" defaultValue={draftUnit}>{units.map(unit => <option key={unit.id}>{unit.name}</option>)}</select></label><label>Data do trabalho<input name="day" type="date" required defaultValue={day} /></label><label>Período<select name="period"><option>Almoço</option><option>Jantar</option><option>Evento</option></select></label><label>Setor<select name="sector">{SECTORS.map(s => <option key={s}>{s}</option>)}</select></label><label>Função<input name="job" required maxLength={80} placeholder="Ex.: auxiliar de cozinha" /></label><label className="ex-wide">Motivo<select name="reason">{['Falta / atestado', 'Folga', 'Vaga aberta', 'Evento', 'Teste de vaga'].map(s => <option key={s}>{s}</option>)}</select></label><label className="ex-wide">Contexto<textarea name="detail" required maxLength={500} placeholder="Por que a operação precisa deste extra?" rows={3} /></label></div><label className="ex-checkbox"><input type="checkbox" checked={emergency || role === 'Caixa'} disabled={role === 'Caixa'} onChange={e => setEmergency(e.target.checked)} /><span>É uma emergência · exceção com alerta imediato à diretoria</span></label><div className="ex-form-grid">{(emergency || role === 'Caixa') && <label className="ex-wide">Recebedor de exemplo<input name="name" required placeholder="Pessoa exemplo" maxLength={100} /></label>}<label>Valor estimado (R$)<input name="value" required inputMode="decimal" placeholder="150,00" /></label></div>
      <div className="ex-budget-decision" role="status">{draftSource.loading ? <p>Consultando alçada. Se enviar antes da consulta, a solicitação normal seguirá para análise da diretoria.</p> : draftSource.error ? <p>{draftSource.error}</p> : draftBudget && <p>Saldo antes desta solicitação: {money(draftBudget.saldo)} · semana {dateLabel(draftBudget.segunda)}–{dateLabel(draftBudget.domingo)}.</p>}{draftSource.budget?.avisos.map(warning => <p key={warning}>{warning}</p>)}{draftRoute && <p>{emergency || role === 'Caixa' ? `Emergência: pagamento demonstrativo permitido, com alerta imediato nesta avaliação.${draftRoute.excesso > 0 ? ` Excede a alçada em ${money(draftRoute.excesso)}.` : ''}` : !draftSource.budget ? 'Alçada não confirmada. A solicitação será registrada para análise da diretoria.' : draftRoute.status === 'aguardando_diretoria' ? `Esta solicitação excede a alçada da semana em ${money(draftRoute.excesso)} e será enviada para aprovação da diretoria.` : 'Esta solicitação cabe no saldo e seguirá para o RH.'}</p>}</div>{error && <p className="ex-error" role="alert">{error}</p>}<button className="ex-primary ex-submit" type="submit">{emergency || role === 'Caixa' ? 'Registrar emergência' : draftRoute?.status === 'aguardando_diretoria' ? 'Enviar para diretoria' : 'Registrar solicitação'}<ArrowRight size={16} /></button></form> : actionItem && action && <form key={`${actionItem.id}-${action}`} onSubmit={applyAction}><p>{actionItem.id} · {actionItem.unit} · {actionItem.job}</p>
      {editingRh ? <><div className="ex-form-grid"><label className="ex-wide">Nome de exemplo<input name="name" required defaultValue={actionItem.name} placeholder="Pessoa exemplo" maxLength={100} /></label><label>Valor (R$)<input name="value" inputMode="decimal" required disabled={action === 'regularizar' || actionItem.emergencyApproved} defaultValue={formMoney(actionItem.value || 15000)} /></label><label className="ex-wide">Pagadora<select name="payer" defaultValue={actionItem.payer} disabled={action === 'regularizar' || actionItem.emergencyApproved}><option>Casa</option><option>Estaff</option></select></label></div><label className="ex-checkbox"><input type="checkbox" name="identity" required defaultChecked={actionItem.identityChecked} /><span>Simular identificação conferida pelo RH · não inserir CPF real</span></label>{action === 'regularizar' && <p className="ex-form-hint">Valores preservados porque o Caixa já informou o pagamento.</p>}</> : action === 'informar' ? <><div className="ex-payment"><Wallet size={23} /><span>{actionItem.payer === 'Casa' ? 'Pagamento pela casa' : 'Liquidação Estaff · simulação'}<strong>{money(total(actionItem))}</strong></span></div><p>{actionItem.payer === 'Estaff' ? 'O formato de liquidação com a Estaff ainda depende de alinhamento. Esta ação demonstra o registro pelo Financeiro.' : 'O Caixa informa o desembolso. O Financeiro ainda precisa conferir antes do encerramento.'}</p><label className="ex-checkbox"><input type="checkbox" name="receipt" required /><span>Anexar comprovante demonstrativo · sem arquivo real</span></label></> : action === 'conferir' ? <><div className="ex-payment"><FileCheck2 size={24} /><span>Comprovante demonstrativo disponível<strong>{money(total(actionItem))}</strong></span></div><label className="ex-checkbox"><input type="checkbox" required /><span>Simular conferência do valor, recebedor e comprovante pelo Financeiro</span></label></> : action === 'reservar' ? <><div className="ex-payment"><Wallet size={24} /><span>{actionItem.payer === 'Casa' ? 'Reserva para entrega ao Caixa' : 'Liberação para o fluxo Estaff'}<strong>{money(total(actionItem))}</strong></span></div><p>{actionItem.payer === 'Casa' ? 'A solicitação entrará na lista de envio ao Caixa.' : 'Este registro permanece com o Financeiro e não entra na lista de dinheiro do Caixa.'}</p></> : <><p>{action === 'aprovar_operacao' ? `Aprovar ${money(total(actionItem))} para ${actionItem.name || actionItem.job}, pela ${actionItem.payer}. ${actionItem.workflow === 'weekly' ? 'Após sua decisão, a solicitação segue para o RH.' : 'Após sua decisão, o Financeiro poderá liberar o recurso.'} A justificativa fica registrada no histórico.` : action === 'aprovar_emergencia' ? `A autorização libera o Caixa para informar o pagamento de ${money(total(actionItem))}. Seu motivo e horário ficam no histórico.` : 'O registro será encerrado com histórico preservado e sairá do custo ativo.'}</p><label>Motivo obrigatório<textarea name="note" required minLength={3} maxLength={500} rows={3} /></label></>}
      {error && <p className="ex-error" role="alert">{error}</p>}<button type="submit" className="ex-primary ex-submit"><Check size={16} />{action === 'preparar_rh' ? (actionItem.workflow === 'weekly' ? 'Conferir cadastro e alçada' : actionItem.emergencyApproved ? 'Confirmar cadastro autorizado' : 'Enviar para aprovação do Diretor') : action === 'regularizar' ? 'Regularizar e encaminhar à conferência' : action === 'informar' ? 'Registrar pagamento demonstrativo' : action === 'conferir' ? 'Confirmar conferência e marcar pago' : LABELS[action]}</button></form>}</>}
    </dialog>
  </div>
}
