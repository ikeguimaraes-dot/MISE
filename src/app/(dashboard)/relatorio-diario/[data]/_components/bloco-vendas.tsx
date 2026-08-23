'use client'

export type VendasState = {
  vendas_ab: string
  alimentos: string
  bebidas: string
  taxa_servico: string
  delivery: string
  portaria_valor: string
  pax_total: string
  perda_produto: string
}

function num(v: string): number { return parseFloat(v) || 0 }
function pct(v: number): string { return isNaN(v) || !isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%` }
function brl(v: number): string { return isNaN(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export function BlocoVendas({
  value,
  onChange,
  disabled,
  erros,
}: {
  value: VendasState
  onChange: (v: VendasState) => void
  disabled?: boolean
  erros?: { vendas_ab?: boolean; pax_total?: boolean }
}) {
  const vendas_ab = num(value.vendas_ab)
  const alimentos = num(value.alimentos)
  const bebidas = num(value.bebidas)
  const taxa_servico = num(value.taxa_servico)
  const delivery = num(value.delivery)
  const portaria_valor = num(value.portaria_valor)
  const pax_total = num(value.pax_total)
  const perda_produto = num(value.perda_produto)

  const faturamento_bruto = vendas_ab + taxa_servico + delivery + portaria_valor
  const ticket_medio = pax_total > 0 ? vendas_ab / pax_total : NaN
  const total_ab = alimentos + bebidas
  const part_alimentos = total_ab > 0 ? alimentos / total_ab : NaN
  const part_bebidas = total_ab > 0 ? bebidas / total_ab : NaN
  const perda_pct = faturamento_bruto > 0 ? perda_produto / faturamento_bruto : NaN

  function field(
    key: keyof VendasState,
    label: string,
    opts: { prefix?: string; integer?: boolean; required?: boolean; erro?: boolean } = {}
  ) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-ink-muted">
          {label}{opts.required && <span className="text-ember ml-0.5">*</span>}
        </label>
        <div className="relative">
          {opts.prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">{opts.prefix}</span>
          )}
          <input
            id={key}
            type="number"
            inputMode={opts.integer ? 'numeric' : 'decimal'}
            step={opts.integer ? '1' : '0.01'}
            min="0"
            value={value[key]}
            onChange={e => onChange({ ...value, [key]: e.target.value })}
            disabled={disabled}
            className={`w-full rounded-lg border bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 ${
              opts.prefix ? 'pl-7' : ''
            } ${
              opts.erro ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
            }`}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Vendas</p>

      <div className="grid grid-cols-2 gap-3">
        {field('vendas_ab', 'Vendas A&B', { prefix: 'R$', required: true, erro: erros?.vendas_ab })}
        {field('pax_total', 'PAX Total', { integer: true, required: true, erro: erros?.pax_total })}
        {field('alimentos', 'Alimentos', { prefix: 'R$' })}
        {field('bebidas', 'Bebidas', { prefix: 'R$' })}
        {field('taxa_servico', 'Taxa de Serviço', { prefix: 'R$' })}
        {field('delivery', 'Delivery', { prefix: 'R$' })}
        {field('portaria_valor', 'Portaria (valor)', { prefix: 'R$' })}
        {field('perda_produto', 'Perda de Produto', { prefix: 'R$' })}
      </div>

      {/* Fechamento calculado — read-only */}
      <div className="rounded-lg border border-edge/50 bg-base p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Fechamento</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <span className="text-ink-muted">Faturamento bruto</span>
          <span className="text-ink text-right font-medium">{brl(faturamento_bruto)}</span>

          <span className="text-ink-muted">Ticket médio</span>
          <span className="text-ink text-right font-medium">{brl(ticket_medio)}</span>

          <span className="text-ink-muted">Part. Alimentos</span>
          <span className="text-ink text-right font-medium">{pct(part_alimentos)}</span>

          <span className="text-ink-muted">Part. Bebidas</span>
          <span className="text-ink text-right font-medium">{pct(part_bebidas)}</span>

          <span className="text-ink-muted">% Perda</span>
          <span className="text-ink text-right font-medium">{pct(perda_pct)}</span>
        </div>
      </div>
    </div>
  )
}
