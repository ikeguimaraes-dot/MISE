'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, type FormEvent } from 'react'
import { CalendarDays, Plus, ArrowLeft, Printer } from 'lucide-react'
import { casas, statuses, groups, text, money, eventTotal, eventSaveRequest, financialFields, operationalPayload, financialPayload, parseMoney, rows, type Evento, type Field } from './model'
import './eventos.css'
import EventDocument from './event-document'

async function api(query = '', method = 'GET', body?: Evento): Promise<Evento[]> {
  const response = await fetch(`/api/eventos/data${query}`, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.')
  return data
}
const date = (value: unknown) => text(value).split('-').reverse().join('/') || '—'
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'

export default function EventosClient({ role, page = 'list' }: { role: string; page?: 'list' | 'dashboard' | 'new' }) {
  const router = useRouter()
  const [events, setEvents] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [house, setHouse] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Evento | null>(page === 'new' ? { status: 'confirmado' } : null)
  const [mode, setMode] = useState<'list' | 'view' | 'edit'>(page === 'new' ? 'edit' : 'list')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const canEdit = role === 'admin' || role === 'gerente'
  async function refresh() {
    setLoading(true); setError('')
    try { setEvents(await api('?order=data_inicio.desc')) } catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  async function open(id: number, edit = false) {
    setBusy(true); setError(''); setNotice('')
    try {
      const [event] = await api(`?id=eq.${id}`)
      if (!event) throw new Error('Esta O.S. não foi encontrada. Atualize a listagem.')
      if (event.id !== id) throw new Error('Não foi possível identificar a O.S. para edição.')
      setEditingId(id); setSelected(event); setMode(edit ? 'edit' : 'view')
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function remove(event: Evento) {
    if (!window.confirm(`Excluir a O.S. “${text(event.nome_evento)}”?`)) return
    setBusy(true); setError('')
    try { await api(`?id=eq.${event.id}`, 'DELETE'); setEvents(current => current.filter(e => e.id !== event.id)); setNotice('O.S. excluída.') }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const filtered = events.filter(e => (!house || e.casa === house) && (!status || e.status === status) && text(e.nome_evento).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  return <section className="mise-events" aria-label="Eventos">
    <header className="events-heading"><div><p className="events-eyebrow"><CalendarDays size={14} /> OPERAÇÃO</p><h1>{mode === 'list' ? page === 'dashboard' ? 'Dashboard de eventos' : 'Eventos' : mode === 'edit' ? selected?.id ? 'Editar O.S.' : 'Nova O.S.' : text(selected?.nome_evento)}</h1><p className="events-subtitle">Ordens de serviço e planejamento dos eventos.</p></div>
      <div className="events-actions no-print">{mode === 'list' ? canEdit && <button className="events-primary" disabled={busy} onClick={() => { router.push('/eventos/nova') }}><Plus size={16} /> Nova O.S.</button> : <><button disabled={busy} onClick={() => { if (mode === 'edit' && !window.confirm('Voltar à lista? Alterações não salvas serão descartadas.')) return; if (page === 'new') { router.push('/eventos/lista'); return }; setMode('list'); setSelected(null); setError('') }}><ArrowLeft size={16} /> Voltar</button>{mode === 'view' && <><button onClick={() => window.print()}><Printer size={16} /> Imprimir</button>{canEdit && <button className="events-primary" onClick={() => setMode('edit')}>Editar O.S.</button>}</>}</>}</div>
    </header>
    {error && <div className="events-error" role="alert">{error} {mode === 'list' && <button onClick={refresh}>Tentar novamente</button>}</div>}
    {notice && <p role="status" className="events-notice">{notice}</p>}
    {mode === 'list' ? <>
      <div className="events-stats">{[['Eventos', filtered.length], ['Confirmados', filtered.filter(e => e.status === 'confirmado').length], ['Em andamento', filtered.filter(e => e.status === 'em_andamento').length], ['Pagos', filtered.filter(e => e.status === 'pago').length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{loading ? '—' : value}</strong></div>)}</div>
      <div className="events-filters"><label>Casa<select value={house} onChange={e => setHouse(e.target.value)}><option value="">Todas as casas</option>{Array.from(new Set([...Object.keys(casas), ...events.map(e => text(e.casa)).filter(Boolean)])).map(c => <option key={c}>{c}</option>)}</select></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos os status</option>{Object.entries(statuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="events-search">Buscar evento<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome do evento ou cliente" /></label><button disabled={loading || busy} onClick={refresh}>Atualizar</button></div>
      {page === 'dashboard' && <div className="events-heading"><h2>Eventos recentes</h2><button onClick={() => router.push('/eventos/lista')}>Ver todos os eventos</button></div>}
      <div className="events-table-wrap"><table><thead><tr>{['Evento', 'Casa', 'Data', 'Pax', 'Responsável op.', 'Criado por', 'Custo A&B', 'Locação', 'Total', 'Status', 'Versão', 'Ações'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={12}>Carregando eventos…</td></tr> : filtered.length === 0 ? <tr><td colSpan={12}>Nenhum evento encontrado.</td></tr> : (page === 'dashboard' ? filtered.slice(0, 8) : filtered).map(e => <tr key={e.id}><td><strong>{text(e.nome_evento)}</strong><small>{text(e.tipo_evento)}</small></td><td>{text(e.casa)}</td><td className="nowrap">{date(e.data_inicio)}</td><td>{text(e.num_convidados) || '—'}</td><td>{text(e.responsavel_operacional) || '—'}</td><td>{text(e.criado_por) || '—'}</td><td className="events-money">{money(e.custo_evento)}</td><td className="events-money">{money(e.valor_cobrado)}</td><td className="events-money"><strong>{money(eventTotal(e.custo_evento, e.valor_cobrado))}</strong></td><td><span className="events-status">{statuses[text(e.status)] || text(e.status)}</span></td><td className="nowrap">V{Number(e.versao ?? 1)}</td><td><div className="events-actions"><button disabled={busy} onClick={() => open(e.id!)}>Ver</button>{canEdit && <button disabled={busy} onClick={() => open(e.id!, true)}>Editar</button>}{role === 'admin' && <button className="events-danger" disabled={busy} onClick={() => remove(e)} aria-label={`Excluir ${text(e.nome_evento)}`}>Excluir</button>}</div></td></tr>)}</tbody></table></div><p className="events-subtitle">{filtered.length} evento(s) · Valores em reais</p>
    </> : selected && <EventForm key={`${selected.id ?? 'new'}-${mode}`} event={selected} readOnly={mode === 'view'} onSave={async body => {
      setBusy(true)
      try {
        const request = eventSaveRequest(page === 'new' && editingId === null ? { kind: 'create' } : { kind: 'edit', id: editingId! }, body)
        const [saved] = await api(request.query, request.method, body)
        if (!saved) throw new Error('A O.S. não foi encontrada para salvar. Atualize a listagem.')
        setEditingId(saved.id!); setSelected(saved)
        setEvents(current => current.some(e => e.id === saved.id) ? current.map(e => e.id === saved.id ? saved : e) : [saved, ...current])
        setNotice(`O.S. salva com sucesso — V${Number(saved.versao ?? 1)}. Você pode salvar os valores abaixo.`)
        return saved
      } finally { setBusy(false) }
    }} onFinancialSave={async body => {
      if (!selected.id) throw new Error('Salve a O.S. primeiro para registrar os valores.')
      setBusy(true)
      try {
        const [saved] = await api(`?id=eq.${selected.id}&section=financeiro`, 'PATCH', body)
        if (!saved) throw new Error('O.S. não encontrada para salvar os valores.')
        setEvents(current => current.map(e => e.id === saved.id ? saved : e))
        return saved
      } finally { setBusy(false) }
    }} />}
  </section>
}

function EventForm({ event, readOnly, onSave, onFinancialSave }: { event: Evento; readOnly: boolean; onSave: (body: Evento) => Promise<Evento>; onFinancialSave: (body: Evento) => Promise<Evento> }) {
  const [draft, setDraft] = useState<Evento>(() => ({ ...event, valor_pago_parcial: event.valor_pago_parcial == null ? '' : Number(event.valor_pago_parcial).toFixed(2).replace('.', ','), nome_evento: text(event.nome_evento).toLocaleUpperCase('pt-BR'), custo_evento: event.custo_evento == null ? '' : Number(event.custo_evento).toFixed(2).replace('.', ','), valor_cobrado: event.valor_cobrado == null ? '' : Number(event.valor_cobrado).toFixed(2).replace('.', ',') }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const saveInFlight = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [financialDirty, setFinancialDirty] = useState(false)
  const [financialSaving, setFinancialSaving] = useState(false)
  const [financialError, setFinancialError] = useState('')
  const [financialNotice, setFinancialNotice] = useState('')
  const financialInFlight = useRef(false)
  useEffect(() => {
    if (!dirty && !financialDirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, financialDirty])
  const set = (key: string, value: unknown) => { if (financialFields.includes(key as typeof financialFields[number])) { setFinancialDirty(true); setFinancialNotice('') } else setDirty(true); setDraft(d => ({ ...d, [key]: key === 'nome_evento' ? text(value).toLocaleUpperCase('pt-BR') : value })) }
  const spaces = text(draft.espacos).split('\n').filter(Boolean)
  function field([key, label, kind, options]: Field) {
    if (key === 'valor_pago_parcial' && draft.pagamento_status !== 'Pagamento parcial' && !text(draft.valor_pago_parcial)) return null
    if (kind === 'total') {
      let total = '—'
      try { total = money(readOnly ? eventTotal(event.custo_evento, event.valor_cobrado) : eventTotal(parseMoney(text(draft.custo_evento)), parseMoney(text(draft.valor_cobrado)))) } catch { /* Wait for valid monetary input. */ }
      return <label key={key}>{label}<output className="events-value" aria-live="polite">{total}</output><small>Custo A&amp;B + Locação</small></label>
    }
    const value = text(draft[key])
    return <label key={key} className={kind === 'textarea' ? 'events-wide' : ''}>{label}{readOnly ? <div className="events-value">{kind === 'money' ? money(event[key]) : kind === 'date' ? date(event[key]) : value || '—'}</div> : kind === 'textarea' ? <textarea rows={3} value={value} onChange={e => set(key, e.target.value)} /> : kind === 'select' ? <select value={value} onChange={e => set(key, e.target.value)}><option value="">Selecione</option>{Array.from(new Set([...(options || []), ...(value ? [value] : [])])).map(o => <option key={o}>{o}</option>)}</select> : <input autoCapitalize={key === 'nome_evento' ? 'characters' : undefined} required={key === 'nome_evento' || (key === 'valor_pago_parcial' && draft.pagamento_status === 'Pagamento parcial')} type={kind === 'money' ? 'text' : kind || 'text'} inputMode={kind === 'money' ? 'decimal' : undefined} min={kind === 'number' ? 0 : undefined} step={kind === 'number' ? 1 : undefined} placeholder={kind === 'money' ? 'Não informado' : undefined} value={value} onChange={e => set(key, e.target.value)} />}</label>
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saveInFlight.current) return
    saveInFlight.current = true
    setError('')
    try {
      if (!text(draft.nome_evento).trim()) throw new Error('Informe o nome do evento.')
      if (!draft.casa || !draft.espacos) throw new Error('Selecione a casa e pelo menos um ambiente.')
      const body: Evento = { ...operationalPayload(draft), nome_evento: text(draft.nome_evento).trim().toLocaleUpperCase('pt-BR'), num_convidados: text(draft.num_convidados) === '' ? null : Number(draft.num_convidados) }
      for (const key of ['data_inicio', 'hora_inicio', 'hora_termino']) body[key] = draft[key] || null
      setSaving(true)
      const saved = await onSave(body)
      setDraft(current => ({ ...current, id: saved.id, versao: saved.versao }))
      setDirty(false); saveInFlight.current = false; setSaving(false)
    } catch (e) { saveInFlight.current = false; setSaving(false); setError(errorMessage(e)) }
  }
  function collection(key: string, title: string, columns: Field[]) {
    const items = rows(draft[key])
    const isMenu = key.startsWith('menu_')
    const info = items.find(row => row.servico === '_info')
    return <section className="events-card" key={key}><h2>{title}</h2>{items.map((item, index) => item.servico === '_info' ? null : <div className="events-row" key={index}>{columns.map(([name, label, kind]) => <label key={name}>{label}{readOnly ? <div className="events-value">{text(item[name]) || '—'}</div> : ['descritivo', 'obs'].includes(name) ? <textarea rows={2} value={text(item[name])} onChange={e => set(key, items.map((r, i) => i === index ? { ...r, [name]: e.target.value } : r))} /> : <input type={kind || 'text'} min={kind === 'number' ? 0 : undefined} value={text(item[name])} onChange={e => set(key, items.map((r, i) => i === index ? { ...r, [name]: kind === 'number' ? Number(e.target.value) : e.target.value } : r))} />}</label>)}{!readOnly && <button type="button" onClick={() => set(key, items.filter((_, i) => i !== index))}>Remover</button>}</div>)}{!readOnly && <button type="button" onClick={() => set(key, [...items, {}])}>+ Adicionar linha</button>}{readOnly && !items.length && <p>—</p>}
      {isMenu && <label className="events-menu-info">Informações gerais — {title.toLowerCase()}{readOnly ? <div className="events-value">{text(info?.descritivo) || '—'}</div> : <textarea rows={3} value={text(info?.descritivo)} onChange={e => set(key, info ? items.map(row => row === info ? { ...row, descritivo: e.target.value } : row) : [...items, { servico: '_info', descritivo: e.target.value }])} />}</label>}
    </section>
  }
  async function attach(key: string, files: File[]) {
    setUploading(true); if (key === 'comprovantes_pagamento') setFinancialError(''); else setError('')
    try {
      const added = await Promise.all(files.map(file => new Promise<Record<string, unknown>>((resolve, reject) => {
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return reject(new Error('Anexe arquivos PDF, JPG ou PNG.'))
        if (file.size > 3 * 1024 * 1024) return reject(new Error('Cada anexo deve ter até 3 MB.'))
        const reader = new FileReader(); reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
        reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result }); reader.readAsDataURL(file)
      })))
      set(key, JSON.stringify([...rows(draft[key]), ...added]))
    } catch (e) { if (key === 'comprovantes_pagamento') setFinancialError(errorMessage(e)); else setError(errorMessage(e)) } finally { setUploading(false) }
  }
  async function submitFinancial(e: FormEvent) {
    e.preventDefault()
    if (!draft.id || financialInFlight.current) return
    financialInFlight.current = true; setFinancialSaving(true); setFinancialError(''); setFinancialNotice('')
    try {
      const financial = financialPayload(draft)
      if (financial.pagamento_status === 'Pagamento parcial' && !(Number(financial.valor_pago_parcial) > 0)) throw new Error('Informe o valor já pago no pagamento parcial.')
      await onFinancialSave(financial)
      setFinancialDirty(false)
      setFinancialNotice('Valores e pagamento salvos. A versão da O.S. foi mantida.')
    } catch (e) { setFinancialError(errorMessage(e)) }
    finally { financialInFlight.current = false; setFinancialSaving(false) }
  }
  function attachment(key: 'layout_anexos' | 'comprovantes_pagamento') {
    return <section className="events-card" key={key}><h2>{key === 'layout_anexos' ? 'Layout e anexos' : 'Comprovantes de pagamento'}</h2>{rows(draft[key]).map((file, index) => <div className="events-attachment" key={index}>{/^data:(application\/pdf|image\/(png|jpeg));base64,/.test(text(file.data)) ? <a href={text(file.data)} download={text(file.name)}>{text(file.name) || 'Baixar anexo'}</a> : <span>{text(file.name)}</span>}{!readOnly && <button type="button" onClick={() => set(key, JSON.stringify(rows(draft[key]).filter((_, i) => i !== index)))}>Remover</button>}</div>)}{!readOnly && <label>Anexar PDF, JPG ou PNG (até 3 MB por arquivo)<input type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={e => { void attach(key, Array.from(e.target.files || [])); e.target.value = '' }} /></label>}</section>
  }
  return <><form onSubmit={submit}><fieldset disabled={saving || financialSaving || uploading} className="events-fieldset">
    <section className="events-card"><h2>Casa e status · V{Number(draft.versao ?? 1)}</h2><div className="events-grid">{readOnly ? <><label>Casa<div className="events-value">{text(draft.casa)}</div></label><label>Status<div className="events-value">{statuses[text(draft.status)] || text(draft.status)}</div></label></> : <><label>Casa<select required value={text(draft.casa)} onChange={e => { set('casa', e.target.value); set('espacos', '') }}><option value="">Selecione</option>{Array.from(new Set([...Object.keys(casas), ...(draft.casa ? [text(draft.casa)] : [])])).map(c => <option key={c}>{c}</option>)}</select></label><label>Status<select value={text(draft.status)} onChange={e => set('status', e.target.value)}>{Array.from(new Set([...Object.keys(statuses), text(draft.status)])).filter(Boolean).map(v => <option key={v} value={v}>{statuses[v] || v}</option>)}</select></label></>}
    <div className="events-wide"><span className="events-label">Ambientes</span><div className="events-spaces">{readOnly ? <p>{spaces.join(' • ') || '—'}</p> : Array.from(new Set([...(casas[text(draft.casa)] || []), ...spaces])).map(space => <label key={space}><input type="checkbox" checked={spaces.includes(space)} onChange={e => set('espacos', (e.target.checked ? [...spaces, space] : spaces.filter(s => s !== space)).join('\n'))} />{space}</label>)}{!draft.casa && <p>Selecione uma casa para escolher os ambientes.</p>}</div></div></div></section>
    {groups.filter(group => group.title !== 'Valores do evento').map(group => <section className="events-card" key={group.title}><h2>{group.title}</h2><div className="events-grid">{group.fields.map(field)}</div></section>)}
    {collection('brigada', 'Brigada', [['funcao', 'Função'], ['qtd', 'Quantidade', 'number']])}
    {(['menu_bar', 'menu_cozinha'] as const).map(key => collection(key, key === 'menu_bar' ? 'Menu bar' : 'Menu cozinha', [['categoria', 'Categoria'], ['servico', 'Serviço'], ['hr_ini', 'Início', 'time'], ['hr_fim', 'Fim', 'time'], ['descritivo', 'Descrição'], ['obs', 'Observações']]))}
    {attachment('layout_anexos')}
    {error && <p className="events-error" role="alert">{error}</p>}
    {!readOnly && <div className="events-save"><span>{uploading ? 'Carregando anexos…' : 'Salva os dados operacionais da O.S.'}</span><button className="events-primary" type="submit">{saving ? 'Salvando…' : 'Salvar O.S.'}</button></div>}
  </fieldset></form>
  <EventDocument eventId={draft.id} readOnly={readOnly} />
  <form onSubmit={submitFinancial} className="events-financial-form" aria-label="Valores do evento">
    <fieldset disabled={saving || financialSaving || uploading || (!readOnly && !draft.id)} className="events-fieldset">
      <section className="events-card"><h2>Valores do evento</h2><p className="events-subtitle">Salvamento independente, sem alterar a versão da O.S.</p>
        {!readOnly && !draft.id && <p role="status" className="events-subtitle">Salve a O.S. acima para habilitar os valores e pagamentos.</p>}
        <div className="events-grid events-menu-info">{groups.find(group => group.title === 'Valores do evento')?.fields.map(field)}</div>
      </section>
      {attachment('comprovantes_pagamento')}
      {financialError && <p className="events-error" role="alert">{financialError}</p>}
      {financialNotice && <p className="events-notice" role="status">{financialNotice}</p>}
      {!readOnly && <div className="events-save"><span>Valores e pagamento não alteram a versão operacional.</span><button className="events-primary" type="submit">{financialSaving ? 'Salvando valores…' : 'Salvar valores'}</button></div>}
    </fieldset>
  </form></>
}
