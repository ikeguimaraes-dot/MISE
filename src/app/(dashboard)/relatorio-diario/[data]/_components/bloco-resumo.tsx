'use client'

export function BlocoResumo({
  value,
  onChange,
  disabled,
  erro,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  erro?: boolean
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
        Resumo Operacional <span className="text-ember ml-0.5">*</span>
      </p>
      <textarea
        id="resumo_operacional"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        placeholder="Descreva como foi o período — destaques, problemas, volume…"
        className={`w-full rounded-lg border px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 bg-base resize-none ${
          erro ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
        }`}
      />
    </div>
  )
}
