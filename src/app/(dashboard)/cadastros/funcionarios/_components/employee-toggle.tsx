'use client'

import { useState } from 'react'

export function EmployeeToggle({ id, miseAtivo }: { id: string; miseAtivo: boolean }) {
  const [active, setActive] = useState(miseAtivo)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleToggle() {
    const next = !active
    setActive(next)
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mise_ativo: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível atualizar o acesso.')
    } catch (error) {
      setActive(!next)
      setError(error instanceof Error ? error.message : 'Falha ao atualizar o acesso.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex max-w-xs flex-col items-end gap-1">
    <button
      type="button"
      aria-label="Acesso ao MISE"
      aria-pressed={active}
      onClick={handleToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        active ? 'bg-fresh' : 'bg-surface-hover'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-ink transition-transform ${
        active ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
    {error && <p role="alert" className="text-xs text-alert-bright">{error}</p>}
    </div>
  )
}
