'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { OCORRENCIA_RH_TIPOS, type OcorrenciaRhTipo } from '@/app/api/relatorio-diario/_schema'
import { RegistroColapsavel } from './registro-colapsavel'
import { SeletorColaborador, type Colaborador } from './seletor-colaborador'

type RhItem = { id: string; employee_name: string; tipo: OcorrenciaRhTipo; cpf: string | null; descricao: string | null }

const TIPO_LABEL: Record<OcorrenciaRhTipo, string> = {
  falta: 'Falta', atestado: 'Atestado', saida_antecipada: 'Saída antecipada',
  contratacao: 'Contratação', desligamento: 'Desligamento', outro: 'Outro',
}

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function BlocoRh({
  relatorioData, unitId, disabled, itensIniciais, colaboradores,
}: {
  relatorioData: string; unitId: string; disabled?: boolean; itensIniciais?: RhItem[]; colaboradores: Colaborador[]
}) {
  const [itens, setItens] = useState<RhItem[]>(itensIniciais ?? [])
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<OcorrenciaRhTipo | ''>('')
  const [cpf, setCpf] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function adicionar() {
    if (!nome.trim() || !tipo) { setErro('Nome e tipo obrigatórios.'); return }
    setSalvando(true); setErro('')
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/rh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, employee_name: nome.trim(), tipo, cpf: cpf || null, descricao: descricao || null }),
    })
    if (res.ok) {
      const item = await res.json()
      setItens(prev => [...prev, item])
      setNome(''); setTipo(''); setCpf(''); setDescricao('')
    } else {
      const { error } = await res.json()
      setErro(error ?? 'Erro ao adicionar.')
    }
    setSalvando(false)
  }

  async function remover(id: string) {
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/rh?unit_id=${unitId}&id=${id}`, { method: 'DELETE' })
    if (res.ok) setItens(prev => prev.filter(i => i.id !== id))
  }

  return (
    <RegistroColapsavel titulo="Ocorrências RH" count={itens.length}>
      {itens.map(item => (
        <div key={item.id} className="flex items-start justify-between rounded-lg border border-edge bg-base px-3 py-2 gap-2">
          <div>
            <p className="text-sm font-medium text-ink">{item.employee_name}</p>
            <p className="text-xs text-ink-muted">{TIPO_LABEL[item.tipo]}{item.cpf && ` · ${item.cpf}`}</p>
            {item.descricao && <p className="text-xs text-ink-subtle mt-0.5">{item.descricao}</p>}
          </div>
          {!disabled && (
            <button onClick={() => remover(item.id)} className="shrink-0 text-ink-faint hover:text-alert transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <div className="space-y-2 pt-1">
          <SeletorColaborador
            colaboradores={colaboradores}
            value={nome}
            onChange={setNome}
            onSelecionarColaborador={c => {
              if (c.cpf) setCpf(mascaraCpf(c.cpf))
            }}
            disabled={disabled}
            placeholder="Nome do colaborador"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select value={tipo} onChange={e => setTipo(e.target.value as OcorrenciaRhTipo | '')}
              className="rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none">
              <option value="">Tipo…</option>
              {OCORRENCIA_RH_TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
            <input type="text" value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))} placeholder="CPF (opcional)"
              className="rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none" />
          </div>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição (opcional)…" rows={2}
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none resize-none" />
          {erro && <p className="text-xs text-alert-bright">{erro}</p>}
          <button onClick={adicionar} disabled={salvando}
            className="w-full rounded-lg bg-surface-raised border border-edge px-3 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors disabled:opacity-50">
            {salvando ? 'Adicionando…' : '+ Adicionar ocorrência RH'}
          </button>
        </div>
      )}
    </RegistroColapsavel>
  )
}
