'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Plus, ArrowLeft, Printer } from 'lucide-react'
import { casas, statuses, groups, text, money, parseMoney, rows, type Evento, type Field } from './model'
import './eventos.css'

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
      setSelected(event); setMode(edit ? 'edit' : 'view')
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
      <div className="events-table-wrap"><table><thead><tr>{['Evento', 'Casa', 'Data', 'Pax', 'Responsável op.', 'Criado por', 'Custo', 'Valor cobrado', 'Status', 'Ações'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={10}>Carregando eventos…</td></tr> : filtered.length === 0 ? <tr><td colSpan={10}>Nenhum evento encontrado.</td></tr> : (page === 'dashboard' ? filtered.slice(0, 8) : filtered).map(e => <tr key={e.id}><td><strong>{text(e.nome_evento)}</strong><small>{text(e.tipo_evento)}</small></td><td>{text(e.casa)}</td><td className="nowrap">{date(e.data_inicio)}</td><td>{text(e.num_convidados) || '—'}</td><td>{text(e.responsavel_operacional) || '—'}</td><td>{text(e.criado_por) || '—'}</td><td className="events-money">{money(e.custo_evento)}</td><td className="events-money">{money(e.valor_cobrado)}</td><td><span className="events-status">{statuses[text(e.status)] || text(e.status)}</span></td><td><div className="events-actions"><button disabled={busy} onClick={() => open(e.id!)}>Ver</button>{canEdit && <button disabled={busy} onClick={() => open(e.id!, true)}>Editar</button>}{role === 'admin' && <button className="events-danger" disabled={busy} onClick={() => remove(e)} aria-label={`Excluir ${text(e.nome_evento)}`}>Excluir</button>}</div></td></tr>)}</tbody></table></div><p className="events-subtitle">{filtered.length} evento(s) · Valores em reais</p>
    </> : selected && <EventForm key={`${selected.id ?? 'new'}-${mode}`} event={selected} readOnly={mode === 'view'} onSave={async body => {
      setBusy(true)
      try {
        const [saved] = await api(selected.id ? `?id=eq.${selected.id}` : '', selected.id ? 'PATCH' : 'POST', body)
        if (!saved) throw new Error('A O.S. não foi encontrada para salvar. Atualize a listagem.')
        if (page === 'new') { router.push('/eventos/lista'); return }
        setSelected(null); setMode('list'); await refresh(); setNotice('O.S. salva com sucesso.')
      } finally { setBusy(false) }
    }} />}
  </section>
}

function EventForm({ event, readOnly, onSave }: { event: Evento; readOnly: boolean; onSave: (body: Evento) => Promise<void> }) {
  const [draft, setDraft] = useState<Evento>(() => ({ ...event, custo_evento: event.custo_evento == null ? '' : Number(event.custo_evento).toFixed(2).replace('.', ','), valor_cobrado: event.valor_cobrado == null ? '' : Number(event.valor_cobrado).toFixed(2).replace('.', ',') }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const set = (key: string, value: unknown) => { setDirty(true); setDraft(d => ({ ...d, [key]: value })) }
  const spaces = text(draft.espacos).split('\n').filter(Boolean)
  function field([key, label, kind, options]: Field) {
    const value = text(draft[key])
    return <label key={key} className={kind === 'textarea' ? 'events-wide' : ''}>{label}{readOnly ? <div className="events-value">{kind === 'money' ? money(event[key]) : kind === 'date' ? date(event[key]) : value || '—'}</div> : kind === 'textarea' ? <textarea rows={3} value={value} onChange={e => set(key, e.target.value)} /> : kind === 'select' ? <select value={value} onChange={e => set(key, e.target.value)}><option value="">Selecione</option>{Array.from(new Set([...(options || []), ...(value ? [value] : [])])).map(o => <option key={o}>{o}</option>)}</select> : <input required={key === 'nome_evento'} type={kind === 'money' ? 'text' : kind || 'text'} inputMode={kind === 'money' ? 'decimal' : undefined} min={kind === 'number' ? 0 : undefined} step={kind === 'number' ? 1 : undefined} placeholder={kind === 'money' ? 'Não informado' : undefined} value={value} onChange={e => set(key, e.target.value)} />}</label>
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('')
    try {
      if (!text(draft.nome_evento).trim()) throw new Error('Informe o nome do evento.')
      if (!draft.casa || !draft.espacos) throw new Error('Selecione a casa e pelo menos um ambiente.')
      const body: Evento = { ...draft, nome_evento: text(draft.nome_evento).trim(), custo_evento: parseMoney(text(draft.custo_evento)), valor_cobrado: parseMoney(text(draft.valor_cobrado)), num_convidados: text(draft.num_convidados) === '' ? null : Number(draft.num_convidados) }
      for (const key of ['data_inicio', 'hora_inicio', 'hora_termino']) body[key] = draft[key] || null
      setSaving(true); await onSave(body); setDirty(false)
    } catch (e) { setError(errorMessage(e)) } finally { setSaving(false) }
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
    setUploading(true); setError('')
    try {
      const added = await Promise.all(files.map(file => new Promise<Record<string, unknown>>((resolve, reject) => {
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return reject(new Error('Anexe arquivos PDF, JPG ou PNG.'))
        if (file.size > 3 * 1024 * 1024) return reject(new Error('Cada anexo deve ter até 3 MB.'))
        const reader = new FileReader(); reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
        reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result }); reader.readAsDataURL(file)
      })))
      set(key, JSON.stringify([...rows(draft[key]), ...added]))
    } catch (e) { setError(errorMessage(e)) } finally { setUploading(false) }
  }
  return <form onSubmit={submit}><fieldset disabled={saving || uploading} className="events-fieldset">
    <section className="events-card"><h2>Casa e status</h2><div className="events-grid">{readOnly ? <><label>Casa<div className="events-value">{text(draft.casa)}</div></label><label>Status<div className="events-value">{statuses[text(draft.status)] || text(draft.status)}</div></label></> : <><label>Casa<select required value={text(draft.casa)} onChange={e => { set('casa', e.target.value); set('espacos', '') }}><option value="">Selecione</option>{Array.from(new Set([...Object.keys(casas), ...(draft.casa ? [text(draft.casa)] : [])])).map(c => <option key={c}>{c}</option>)}</select></label><label>Status<select value={text(draft.status)} onChange={e => set('status', e.target.value)}>{Array.from(new Set([...Object.keys(statuses), text(draft.status)])).filter(Boolean).map(v => <option key={v} value={v}>{statuses[v] || v}</option>)}</select></label></>}
    <div className="events-wide"><span className="events-label">Ambientes</span><div className="events-spaces">{readOnly ? <p>{spaces.join(' • ') || '—'}</p> : Array.from(new Set([...(casas[text(draft.casa)] || []), ...spaces])).map(space => <label key={space}><input type="checkbox" checked={spaces.includes(space)} onChange={e => set('espacos', (e.target.checked ? [...spaces, space] : spaces.filter(s => s !== space)).join('\n'))} />{space}</label>)}{!draft.casa && <p>Selecione uma casa para escolher os ambientes.</p>}</div></div></div></section>
    {groups.map(group => <section className="events-card" key={group.title}><h2>{group.title}</h2><div className="events-grid">{group.fields.map(field)}</div></section>)}
    {collection('brigada', 'Brigada', [['funcao', 'Função'], ['qtd', 'Quantidade', 'number']])}
    {(['menu_bar', 'menu_cozinha'] as const).map(key => collection(key, key === 'menu_bar' ? 'Menu bar' : 'Menu cozinha', [['categoria', 'Categoria'], ['servico', 'Serviço'], ['hr_ini', 'Início', 'time'], ['hr_fim', 'Fim', 'time'], ['descritivo', 'Descrição'], ['obs', 'Observações']]))}
    {(['layout_anexos', 'comprovantes_pagamento'] as const).map(key => <section className="events-card" key={key}><h2>{key === 'layout_anexos' ? 'Layout e anexos' : 'Comprovantes de pagamento'}</h2>{rows(draft[key]).map((file, index) => <div className="events-attachment" key={index}>{/^data:(application\/pdf|image\/(png|jpeg));base64,/.test(text(file.data)) ? <a href={text(file.data)} download={text(file.name)}>{text(file.name) || 'Baixar anexo'}</a> : <span>{text(file.name)}</span>}{!readOnly && <button type="button" onClick={() => set(key, JSON.stringify(rows(draft[key]).filter((_, i) => i !== index)))}>Remover</button>}</div>)}{!readOnly && <label>Anexar PDF, JPG ou PNG (até 3 MB por arquivo)<input type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={e => { void attach(key, Array.from(e.target.files || [])); e.target.value = '' }} /></label>}</section>)}
    {error && <p className="events-error" role="alert">{error}</p>}
    {!readOnly && <div className="events-save"><span>{uploading ? 'Carregando anexos…' : 'Custo e valor cobrado podem ser preenchidos depois.'}</span><button className="events-primary" type="submit">{saving ? 'Salvando…' : 'Salvar O.S.'}</button></div>}
  </fieldset></form>
}
