'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Users, ArrowLeft, Plus } from 'lucide-react';
import './extras-real.css';
type Requester = { id: string; unit_id: string; nome: string; ativo: boolean };
export function ExtrasRequesters({ units, initialUnit }: { units: { id: string; name: string }[]; initialUnit?: string }) {
  const [unit, setUnit] = useState(initialUnit || units[0].id);
  const [items, setItems] = useState<Requester[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0), [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null), [name, setName] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setItems([]); setLoading(true); setError(''); setEditing(null);
    fetch(`/api/extras/solicitantes?unit_id=${unit}&all=1`, { cache: 'no-store', signal: controller.signal })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); if (!controller.signal.aborted) setItems(data.items); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [unit, revision]);
  async function save(patch: { id?: string; nome?: string; ativo?: boolean }) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/extras/solicitantes', { method: patch.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...patch, unit_id: unit }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setItems(prev => [...prev.filter(r => r.id !== data.item.id), data.item].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      setEditing(null); if (!patch.id) setNewName('');
      setMessage(patch.ativo === false ? 'Solicitante desativado. Os pedidos anteriores mantêm o nome registrado.' : 'Cadastro salvo. Os pedidos anteriores permanecem como foram registrados.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  function add(event: FormEvent) { event.preventDefault(); void save({ nome: newName }); }
  return <div className="er">
    <header className="er-heading"><div><h1><Users size={21} aria-hidden="true" />Solicitantes de Extras</h1><p>Quem pode ser indicado como solicitante em cada casa.</p></div><nav aria-label="Navegação de solicitantes"><Link href={`/extras?unit_id=${unit}`}><ArrowLeft size={14} aria-hidden="true" />Voltar para Extras</Link><Link href="/extras/acessos">Gerenciar acessos</Link></nav></header>
    <div className="er-filters"><label htmlFor="requester-unit">Casa<select id="requester-unit" value={unit} disabled={busy} onChange={e => { setUnit(e.target.value); setNewName(''); setMessage(''); }}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label></div>
    <p>Este cadastro organiza os nomes declarados no formulário. Não concede acesso ao sistema e não comprova quem usou um login compartilhado.</p>
    <section className="er-panel er-requester-management"><h2>Adicionar solicitante</h2><form className="er-filters er-add-requester" onSubmit={add}><label htmlFor="new-requester-name">Nome<input id="new-requester-name" value={newName} onChange={e => setNewName(e.target.value)} maxLength={150} required disabled={busy} placeholder="Nome do solicitante" /></label><button className="er-primary" disabled={busy || !newName.trim()}><Plus size={15} aria-hidden="true" />Adicionar</button></form></section>
    {error && <p role="alert" className="er-error">{error} <button type="button" onClick={() => setRevision(v => v + 1)}>Recarregar lista</button></p>}
    {message && <p role="status">{message}</p>}
    <section className="er-panel er-requester-management"><div className="er-list-heading"><h2>Cadastro da casa</h2><span className="er-count">{loading ? 'Carregando…' : `${items.filter(r => r.ativo).length} ativos · ${items.filter(r => !r.ativo).length} inativos`}</span></div>
      {!loading && !items.length && !error && <p>Nenhum solicitante cadastrado nesta casa.</p>}
      <ul className="er-requester-directory">{items.map(r => <li key={r.id}>
        {editing === r.id ? <form onSubmit={e => { e.preventDefault(); void save({ id: r.id, nome: name }); }}><label htmlFor={`rename-${r.id}`}>Nome<input id={`rename-${r.id}`} value={name} onChange={e => setName(e.target.value)} required maxLength={150} disabled={busy} /></label><button disabled={busy || !name.trim()}>Salvar nome</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button></form> : <><div><strong>{r.nome}</strong><small>{r.ativo ? 'Ativo' : 'Inativo'}</small></div><div className="er-buttons"><button disabled={busy || loading} onClick={() => { setEditing(r.id); setName(r.nome); }}>Renomear<span className="sr-only"> {r.nome}</span></button><button disabled={busy || loading} onClick={() => void save({ id: r.id, ativo: !r.ativo })}>{r.ativo ? 'Desativar' : 'Reativar'}<span className="sr-only"> {r.nome}</span></button></div></>}
      </li>)}</ul>
    </section>
  </div>;
}
