'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface Props {
  unitId: string
  data: string
  label: string // dd/mm — valor que o admin digita pra confirmar
}

export function BotaoExcluirDia({ unitId, data, label }: Props) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [confirmValue, setConfirmValue] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (confirmando) inputRef.current?.focus()
  }, [confirmando])

  async function handleExcluir() {
    if (confirmValue !== label || excluindo) return
    setExcluindo(true)
    try {
      const res = await fetch(`/api/relatorio-diario/${data}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const { error } = await res.json()
        alert(error ?? 'Erro ao excluir.')
        setExcluindo(false)
        setConfirmando(false)
        setConfirmValue('')
      }
    } catch {
      alert('Erro de rede.')
      setExcluindo(false)
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        title={`Excluir relatório de ${label}`}
        onClick={() => setConfirmando(true)}
        className="p-2 text-ink-faint hover:text-alert transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 py-2 pr-3">
      <input
        ref={inputRef}
        type="text"
        placeholder={label}
        value={confirmValue}
        onChange={e => setConfirmValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleExcluir()
          if (e.key === 'Escape') { setConfirmando(false); setConfirmValue('') }
        }}
        className="w-16 rounded border border-edge px-2 py-1 text-xs text-ink bg-surface focus:outline-none focus:border-alert"
      />
      <button
        type="button"
        onClick={handleExcluir}
        disabled={confirmValue !== label || excluindo}
        className="rounded px-2 py-1 text-xs font-medium bg-alert text-white disabled:opacity-40"
      >
        {excluindo ? '…' : 'Excluir'}
      </button>
      <button
        type="button"
        onClick={() => { setConfirmando(false); setConfirmValue('') }}
        className="rounded px-2 py-1 text-xs text-ink-muted hover:text-ink transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
