'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function RegistroColapsavel({
  titulo,
  count,
  children,
}: {
  titulo: string
  count: number
  children: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="rounded-xl border border-edge bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-surface-raised/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink">{titulo}</span>
          {count > 0 && (
            <span className="rounded-full bg-ember/10 px-2 py-0.5 text-xs font-semibold text-ember">
              {count}
            </span>
          )}
        </div>
        {aberto ? (
          <ChevronUp className="h-4 w-4 text-ink-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-ink-muted" />
        )}
      </button>
      {aberto && (
        <div className="border-t border-edge px-5 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}
