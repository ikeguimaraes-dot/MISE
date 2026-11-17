'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { expiryToLocalInput } from '@/lib/shelf-life'
import { saoPauloIso } from '@/lib/label-expiry'

export function LabelExpiryEditor({ id, manipulation, expiry, onSaved }: { id: string; manipulation: string; expiry: string; onSaved?: () => void | Promise<void> }) {
  const router = useRouter()
  const [mode, setMode] = useState<'hours' | 'date'>('hours')
  const [hours, setHours] = useState(String((new Date(expiry).getTime() - new Date(manipulation).getTime()) / 3_600_000))
  const [date, setDate] = useState(expiryToLocalInput(expiry))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = mode === 'hours' ? { prazo_horas: Number(hours) } : { validade_manual: saoPauloIso(date) }
      const response = await fetch(`/api/labels/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok || result.label?.id !== id) throw new Error(result.error || 'Não foi possível confirmar a alteração.')
      if (onSaved) await onSaved()
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Falha ao alterar a validade.') }
    finally { setSaving(false) }
  }

  return <details className="text-xs">
    <summary className="cursor-pointer text-ember">Alterar validade (admin)</summary>
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg border border-edge bg-surface p-3">
      <label className="block">Alterar por<select value={mode} onChange={e => setMode(e.target.value as 'hours' | 'date')} disabled={saving} className="mt-1 block rounded border border-edge bg-surface-raised p-2"><option value="hours">Prazo em horas desde a manipulação</option><option value="date">Data e hora de vencimento</option></select></label>
      {mode === 'hours' ? <label className="block">Prazo em horas<input required type="number" min="0.01" step="any" value={hours} onChange={e => setHours(e.target.value)} className="mt-1 block rounded border border-edge bg-surface-raised p-2" /></label> : <label className="block">Vencimento (horário de São Paulo)<input required type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block rounded border border-edge bg-surface-raised p-2" /></label>}
      <p className="text-ink-muted">O prazo é contado a partir da manipulação, não do horário desta alteração.</p>
      <button disabled={saving} className="rounded bg-ember px-3 py-2 font-semibold text-ember-ink disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar validade'}</button>
      {error && <p role="alert" className="text-alert-bright">{error}</p>}
    </form>
  </details>
}
