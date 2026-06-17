'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Copy } from 'lucide-react'

const TIPO_COLORS: Record<string, string> = {
  abertura: 'border-l-emerald-500 bg-emerald-500/5',
  fechamento: 'border-l-red-500 bg-red-500/5',
  rotina: 'border-l-blue-500 bg-blue-500/5',
  relatorio: 'border-l-purple-500 bg-purple-500/5',
  treinamento: 'border-l-yellow-500 bg-yellow-500/5',
}

const TIPO_LABEL: Record<string, string> = {
  abertura: 'Abertura', fechamento: 'Fechamento', rotina: 'Rotina',
  relatorio: 'Relatório', treinamento: 'Treinamento',
}

function scoreColor(pct: number | null) {
  if (pct === null) return 'text-neutral-500'
  if (pct >= 80) return 'text-emerald-400'
  if (pct >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

type Props = {
  template: {
    id: string
    nome: string
    tipo: string | null
    departamento: string | null
    unit_id: string | null
  }
  score: number | null
  count: number
  unitName: string | null
}

export function TemplateCard({ template, score, count, unitName }: Props) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const colorClass = TIPO_COLORS[template.tipo ?? ''] ?? 'border-l-neutral-600 bg-neutral-800/30'

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function handleDuplicar() {
    setMenuOpen(false)
    setDuplicating(true)
    try {
      const res = await fetch(`/api/checklists/${template.id}/duplicar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert(`Erro ao duplicar: ${data.error}`)
        return
      }
      router.refresh()
    } catch {
      alert('Erro ao duplicar checklist.')
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <div className={`rounded-lg border border-neutral-800 border-l-4 ${colorClass} bg-neutral-900 p-5 flex flex-col gap-3 ${duplicating ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-white leading-tight">{template.nome}</h3>
        <div className="flex items-center gap-1 shrink-0">
          {template.tipo && (
            <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-400">
              {TIPO_LABEL[template.tipo] ?? template.tipo}
            </span>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors"
              aria-label="Mais opções"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-20 w-36 rounded-lg border border-neutral-800 bg-neutral-950 shadow-lg py-1">
                <Link
                  href={`/checklists/${template.id}/editar`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Link>
                <button
                  onClick={handleDuplicar}
                  disabled={duplicating}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {template.departamento && (
        <p className="text-xs text-neutral-500">{template.departamento}</p>
      )}

      {template.unit_id && unitName && (
        <p className="text-xs text-neutral-600">{unitName}</p>
      )}

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{count} {count === 1 ? 'item' : 'itens'}</span>
        <span>
          Última: <span className={`font-bold ${scoreColor(score)}`}>
            {score !== null ? `${score.toFixed(0)}%` : '—'}
          </span>
        </span>
      </div>

      <div className="flex gap-2 pt-1">
        <Link
          href={`/checklists/${template.id}`}
          className="flex-1 rounded border border-neutral-700 px-3 py-1.5 text-center text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
        >
          Ver detalhes
        </Link>
        <Link
          href={`/checklists/${template.id}`}
          className="flex-1 rounded bg-emerald-700 px-3 py-1.5 text-center text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
        >
          Executar
        </Link>
      </div>
    </div>
  )
}
