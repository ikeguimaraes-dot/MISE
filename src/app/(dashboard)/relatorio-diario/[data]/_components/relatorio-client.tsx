'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X } from 'lucide-react'
import { PERIODO_LABEL, SETORES_AVALIACAO, SETORES_EQUIPE, SETOR_EQUIPE_TO_AREA, AREA_TO_SETOR_EQUIPE } from '@/app/api/relatorio-diario/_schema'
import type { SetorAvaliacao, SetorEquipe } from '@/app/api/relatorio-diario/_schema'
import { BlocoHorarios, type HorariosState } from './bloco-horarios'
import { BlocoVendas, type VendasState } from './bloco-vendas'
import { BlocoClima, type ClimaState } from './bloco-clima'
import { BlocoSetores, type AvaliacaoSetoresState } from './bloco-setores'
import { BlocoResumo } from './bloco-resumo'
import { BlocoOcorrencia, type OcorrenciaState } from './bloco-ocorrencia'
import { BlocoEquipe, type EquipeState } from './bloco-equipe'
import { CampoResponsavel } from './campo-responsavel'
import { Bloco86 } from './bloco-86'
import { BlocoFeedback } from './bloco-feedback'
import { BlocoRh } from './bloco-rh'
import { BlocoPortaria, type PortariaState } from './bloco-portaria'

type FormState = {
  horarios: HorariosState
  vendas: VendasState
  clima: ClimaState
  setores: AvaliacaoSetoresState
  resumo: string
  ocorrencia: OcorrenciaState
  equipe: EquipeState
  responsavel: string
  portaria: PortariaState
}

type FormErros = {
  vendas_ab?: boolean
  pax_total?: boolean
  alimentos?: boolean
  bebidas?: boolean
  taxa_servico?: boolean
  delivery?: boolean
  portaria_valor?: boolean
  perda_produto?: boolean
  resumo?: boolean
  responsavel?: boolean
  setores?: Partial<Record<SetorAvaliacao, boolean>>
  equipe?: Partial<Record<SetorEquipe, boolean>>
}

function estadoInicial(
  row: Record<string, unknown> | undefined,
  avaliacoesPeriodo?: { setor: string; nota: number | null; observacao: string | null }[],
  faltasPeriodo?: { area: string; lider_turno: string | null; houve_falta: boolean; nomes: string | null }[]
): FormState {
  const setoresBase = Object.fromEntries(
    SETORES_AVALIACAO.map(s => [s, { nota: null as number | null, obs: '' }])
  ) as AvaliacaoSetoresState
  for (const av of avaliacoesPeriodo ?? []) {
    if (av.setor in setoresBase) {
      setoresBase[av.setor as SetorAvaliacao] = { nota: av.nota, obs: av.observacao ?? '' }
    }
  }
  return {
    horarios: {
      abertura: String(row?.horario_abertura ?? ''),
      ultimo_cliente: String(row?.horario_ultimo_cliente ?? ''),
      fechamento: String(row?.horario_fechamento ?? ''),
    },
    vendas: {
      vendas_ab: String(row?.venda_total ?? ''),
      alimentos: String(row?.venda_alimentos ?? ''),
      bebidas: String(row?.venda_bebidas ?? ''),
      taxa_servico: String(row?.taxa_servico ?? ''),
      delivery: String(row?.delivery ?? ''),
      portaria_valor: String(row?.portaria ?? ''),
      pax_total: String(row?.pax_total ?? ''),
      perda_produto: String(row?.perda_produto ?? ''),
    },
    clima: {
      tempo: String(row?.clima_tempo ?? ''),
      temperatura: String(row?.clima_temperatura ?? ''),
    },
    setores: setoresBase,
    resumo: String(row?.resumo_operacional ?? ''),
    ocorrencia: {
      houve: Boolean(row?.houve_ocorrencia),
      descricao: String(row?.ocorrencia_texto ?? ''),
    },
    equipe: Object.fromEntries(
      SETORES_EQUIPE.map(s => {
        const areaEnum = SETOR_EQUIPE_TO_AREA[s]
        const f = (faltasPeriodo ?? []).find(x => x.area === areaEnum)
        return [s, {
          lider: f?.lider_turno ?? '',
          houveFalta: f?.houve_falta ?? false,
          ausentes: f?.nomes ? f.nomes.split('\n').filter(Boolean) : [''],
        }]
      })
    ) as EquipeState,
    responsavel: String(row?.responsavel_preenchimento ?? ''),
    portaria: {
      reservas: row?.portaria_reservas_previstas != null ? String(row.portaria_reservas_previstas) : '',
      no_show: row?.portaria_noshow_qty != null ? String(row.portaria_noshow_qty) : '',
      passantes: row?.portaria_passantes != null ? String(row.portaria_passantes) : '',
    },
  }
}

function fmtDataPorExtenso(dataParam: string): string {
  const d = new Date(`${dataParam}T12:00:00Z`)
  const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
  const dia = d.toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'UTC' })
  const mes = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const ano = d.getFullYear()
  return `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${dia} de ${mes} de ${ano}`
}

export function RelatorioClient({
  relatorio,
  periodos,
  periodosAtivos,
  unitId,
  unitName,
  dataParam,
  role,
  feedbacks,
  avaliacoesSetor,
  desistencias,
  colaboradores,
  faltas,
}: {
  relatorio: Record<string, unknown>
  periodos: Record<string, unknown>[]
  periodosAtivos: string[]
  unitId: string
  unitName: string
  dataParam: string
  role: string
  feedbacks: { id: string; tipo: string; produto: string | null; categoria: string | null; texto: string | null }[]
  avaliacoesSetor: { periodo: string; setor: string; nota: number | null; observacao: string | null }[]
  desistencias: { id: string; periodo: string | null; motivo: string | null; pax_perdido: number | null }[]
  colaboradores: { id: string; nome: string; sobrenome: string | null; funcao: string | null; cpf: string | null }[]
  faltas: { periodo: string; area: string; lider_turno: string | null; houve_falta: boolean; nomes: string | null }[]
}) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const isHoje = dataParam === hoje
  const relatorioFechado = relatorio.status === 'enviado'

  const [periodoAtivo, setPeriodoAtivo] = useState(periodosAtivos[0] ?? 'almoco')
  const [form, setForm] = useState<FormState>(() =>
    estadoInicial(
      periodos.find(p => p.periodo === periodoAtivo) as Record<string, unknown>,
      avaliacoesSetor.filter(a => a.periodo === periodoAtivo),
      faltas.filter(f => f.periodo === periodoAtivo)
    )
  )
  const [erros, setErros] = useState<FormErros>({})
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const router = useRouter()
  const enviados = periodos.filter(
    p => p.enviado_em && periodosAtivos.includes(p.periodo as string)
  )
  // Períodos marcados como "não se aplica" saem da conta: não contam
  // como pendentes. Estado local semeado do server, atualizável pelo X.
  const [naoSeAplica, setNaoSeAplica] = useState<string[]>(
    periodos
      .filter(p => p.status === 'nao_se_aplica' && periodosAtivos.includes(p.periodo as string))
      .map(p => p.periodo as string)
  )
  const [naOcupado, setNaOcupado] = useState<string | null>(null)

  async function toggleNaoSeAplica(periodo: string, aplicar: boolean) {
    setNaOcupado(periodo)
    try {
      const res = await fetch(`/api/relatorio-diario/${dataParam}/periodos/${periodo}/na`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId, aplicar }),
      })
      if (res.ok) {
        setNaoSeAplica(prev => aplicar ? [...prev, periodo] : prev.filter(p => p !== periodo))
        router.refresh()
      }
    } finally {
      setNaOcupado(null)
    }
  }

  const aplicaveis = periodosAtivos.filter(p => !naoSeAplica.includes(p))
  const progressoPct = aplicaveis.length > 0
    ? Math.round((enviados.length / aplicaveis.length) * 100)
    : 0

  const periodoAtualEnviado = periodos.some(
    p => p.periodo === periodoAtivo && p.enviado_em
  )
  const disabled = periodoAtualEnviado || relatorioFechado || role === 'cozinheiro'

  // Ao trocar de aba, recarregar estado do período
  useEffect(() => {
    setForm(estadoInicial(
      periodos.find(p => p.periodo === periodoAtivo) as Record<string, unknown>,
      avaliacoesSetor.filter(a => a.periodo === periodoAtivo),
      faltas.filter(f => f.periodo === periodoAtivo)
    ))
    setErros({})
  }, [periodoAtivo]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFormChange(partial: Partial<FormState>) {
    const next = { ...form, ...partial }
    setForm(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => salvarRascunho(next), 1500)
  }

  async function salvarRascunho(estado: FormState) {
    setSalvando(true)
    await fetch(`/api/relatorio-diario/${dataParam}/periodos/${periodoAtivo}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_id: unitId,
        horario_abertura: estado.horarios.abertura || null,
        horario_ultimo_cliente: estado.horarios.ultimo_cliente || null,
        horario_fechamento: estado.horarios.fechamento || null,
        venda_total: estado.vendas.vendas_ab ? parseFloat(estado.vendas.vendas_ab) : null,
        venda_alimentos: estado.vendas.alimentos ? parseFloat(estado.vendas.alimentos) : null,
        venda_bebidas: estado.vendas.bebidas ? parseFloat(estado.vendas.bebidas) : null,
        taxa_servico: estado.vendas.taxa_servico ? parseFloat(estado.vendas.taxa_servico) : null,
        delivery: estado.vendas.delivery ? parseFloat(estado.vendas.delivery) : null,
        portaria: estado.vendas.portaria_valor ? parseFloat(estado.vendas.portaria_valor) : null,
        pax_total: estado.vendas.pax_total ? parseInt(estado.vendas.pax_total) : null,
        perda_produto: estado.vendas.perda_produto ? parseFloat(estado.vendas.perda_produto) : null,
        clima_tempo: estado.clima.tempo || null,
        clima_temperatura: estado.clima.temperatura ? parseFloat(estado.clima.temperatura) : null,
        resumo_operacional: estado.resumo || null,
        houve_ocorrencia: estado.ocorrencia.houve,
        ocorrencia_texto: estado.ocorrencia.descricao || null,
        responsavel_preenchimento: estado.responsavel || null,
        setores: estado.setores,
        portaria_reservas_previstas: estado.portaria.reservas !== '' ? parseInt(estado.portaria.reservas) : null,
        portaria_noshow_qty: estado.portaria.no_show !== '' ? parseInt(estado.portaria.no_show) : null,
        portaria_passantes: estado.portaria.passantes !== '' ? parseInt(estado.portaria.passantes) : null,
        equipe: SETORES_EQUIPE.map(s => ({
          area: SETOR_EQUIPE_TO_AREA[s],
          lider_turno: estado.equipe[s].lider || null,
          houve_falta: estado.equipe[s].houveFalta,
          nomes: estado.equipe[s].houveFalta
            ? estado.equipe[s].ausentes.filter(Boolean).join('\n') || null
            : null,
        })),
      }),
    })
    setSalvando(false)
  }

  function validar(estado: FormState): { valido: boolean; erros: FormErros; primeiroId: string | null } {
    const e: FormErros = {}
    let primeiroId: string | null = null

    // Todos os campos de venda são obrigatórios — mas '0' é válido,
    // só string vazia reprova (regra: preencher tudo, mesmo que zero).
    const camposVenda: [keyof typeof estado.vendas, keyof FormErros, string][] = [
      ['vendas_ab', 'vendas_ab', 'vendas_ab'],
      ['pax_total', 'pax_total', 'pax_total'],
      ['alimentos', 'alimentos', 'alimentos'],
      ['bebidas', 'bebidas', 'bebidas'],
      ['taxa_servico', 'taxa_servico', 'taxa_servico'],
      ['delivery', 'delivery', 'delivery'],
      ['portaria_valor', 'portaria_valor', 'portaria_valor'],
      ['perda_produto', 'perda_produto', 'perda_produto'],
    ]
    for (const [campo, chaveErro, id] of camposVenda) {
      if (estado.vendas[campo] === '') { (e[chaveErro] as boolean) = true; primeiroId ??= id }
    }
    if (!estado.resumo.trim()) { e.resumo = true; primeiroId ??= 'resumo_operacional' }
    if (!estado.responsavel.trim()) { e.responsavel = true; primeiroId ??= 'responsavel_preenchimento' }

    const setoresErro: FormErros['setores'] = {}
    for (const setor of SETORES_AVALIACAO) {
      const av = estado.setores[setor]
      if (av.nota !== null && av.nota <= 2 && !av.obs.trim()) {
        setoresErro[setor] = true
        primeiroId ??= `setor-obs-${setor}`
      }
    }
    if (Object.keys(setoresErro).length) e.setores = setoresErro

    const equipeErro: FormErros['equipe'] = {}
    for (const setor of SETORES_EQUIPE) {
      if (!estado.equipe[setor].lider.trim()) {
        equipeErro[setor] = true
        primeiroId ??= `equipe-lider-${setor}`
      }
    }
    if (Object.keys(equipeErro).length) e.equipe = equipeErro

    return { valido: Object.keys(e).length === 0, erros: e, primeiroId }
  }

  async function handleEnviar() {
    const { valido, erros: novosErros, primeiroId } = validar(form)
    if (!valido) {
      setErros(novosErros)
      if (primeiroId) {
        document.getElementById(primeiroId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    setErros({})
    setEnviando(true)

    // Save-then-submit: garantir que o período está persistido antes do envio
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await salvarRascunho(form)

    const res = await fetch(`/api/relatorio-diario/${dataParam}/periodos/${periodoAtivo}/enviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      alert(error)
      setEnviando(false)
      return
    }

    window.location.reload()
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Link href={`/relatorio-diario?unit_id=${unitId}`} className="text-ink-muted hover:text-ink transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-ink">{fmtDataPorExtenso(dataParam)}</h1>
            {isHoje && (
              <span className="rounded-full bg-ember/10 px-2 py-0.5 text-xs font-semibold text-ember">Hoje</span>
            )}
          </div>
        </div>
        <p className="pl-8 text-sm text-ink-muted">{unitName} · Relatório Diário</p>
      </div>

      {/* Progresso */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-ink-muted">
          <span>{enviados.length} de {aplicaveis.length} períodos enviados</span>
          <span>{progressoPct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
          <div className="h-full rounded-full bg-ember transition-all" style={{ width: `${progressoPct}%` }} />
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2">
        {periodosAtivos.map(p => {
          const enviado = periodos.some(row => row.periodo === p && row.enviado_em)
          const na = naoSeAplica.includes(p)
          const ativo = periodoAtivo === p
          const ocupado = naOcupado === p
          return (
            <div
              key={p}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                ativo
                  ? 'bg-ember text-white'
                  : na
                  ? 'bg-surface border border-edge text-ink-faint'
                  : 'bg-surface border border-edge text-ink-muted'
              } ${ocupado ? 'opacity-50' : ''}`}
            >
              <button
                type="button"
                onClick={() => setPeriodoAtivo(p)}
                className={`flex items-center gap-1.5 ${na && !ativo ? 'line-through' : ''} ${!ativo ? 'hover:text-ink' : ''}`}
              >
                {PERIODO_LABEL[p] ?? p}
                {enviado && <Check className="h-3.5 w-3.5 text-fresh" />}
                {na && <span className="text-[10px] no-underline">N/A</span>}
              </button>
              {/* X para dispensar o turno (só quando não enviado). Se já
                  está N/A, o X reverte. */}
              {!enviado && !disabled && (
                <button
                  type="button"
                  onClick={() => toggleNaoSeAplica(p, !na)}
                  disabled={ocupado}
                  title={na ? 'Reverter — voltar a aplicar' : 'Não há este turno neste dia'}
                  className={`ml-0.5 rounded p-0.5 transition-colors ${
                    ativo ? 'text-white/70 hover:text-white' : 'text-ink-faint hover:text-alert'
                  } ${na ? 'rotate-45' : ''}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Formulário */}
      <div className="space-y-4">
        <BlocoHorarios
          value={form.horarios}
          onChange={horarios => handleFormChange({ horarios })}
          disabled={disabled}
        />
        <BlocoVendas
          value={form.vendas}
          onChange={vendas => handleFormChange({ vendas })}
          disabled={disabled}
          erros={{ vendas_ab: erros.vendas_ab, pax_total: erros.pax_total, alimentos: erros.alimentos, bebidas: erros.bebidas, taxa_servico: erros.taxa_servico, delivery: erros.delivery, portaria_valor: erros.portaria_valor, perda_produto: erros.perda_produto }}
        />
        <BlocoClima
          value={form.clima}
          onChange={clima => handleFormChange({ clima })}
          disabled={disabled}
        />
        <BlocoSetores
          value={form.setores}
          onChange={setores => handleFormChange({ setores })}
          disabled={disabled}
          erros={erros.setores}
        />
        <BlocoResumo
          value={form.resumo}
          onChange={resumo => handleFormChange({ resumo })}
          disabled={disabled}
          erro={erros.resumo}
        />
        <BlocoOcorrencia
          value={form.ocorrencia}
          onChange={ocorrencia => handleFormChange({ ocorrencia })}
          disabled={disabled}
        />
        <BlocoEquipe
          value={form.equipe}
          onChange={equipe => handleFormChange({ equipe })}
          disabled={disabled}
          colaboradores={colaboradores}
          erros={erros.equipe}
        />

        {/* Registros colapsáveis */}
        <Bloco86 relatorioData={dataParam} unitId={unitId} disabled={disabled} />
        <BlocoFeedback tipo="elogio" relatorioData={dataParam} unitId={unitId} disabled={disabled}
          itensIniciais={feedbacks.filter(f => f.tipo === 'elogio').map(f => ({ id: f.id, tipo: f.tipo, produto: f.produto, categoria: f.categoria, descricao: f.texto }))} />
        <BlocoFeedback tipo="reclamacao" relatorioData={dataParam} unitId={unitId} disabled={disabled}
          itensIniciais={feedbacks.filter(f => f.tipo === 'reclamacao').map(f => ({ id: f.id, tipo: f.tipo, produto: f.produto, categoria: f.categoria, descricao: f.texto }))} />
        <BlocoRh relatorioData={dataParam} unitId={unitId} disabled={disabled} colaboradores={colaboradores} />
        <BlocoPortaria
          value={form.portaria}
          onChange={portaria => handleFormChange({ portaria })}
          relatorioData={dataParam}
          unitId={unitId}
          periodo={periodoAtivo}
          disabled={disabled}
          desistenciasIniciais={desistencias.filter(d => d.periodo === periodoAtivo).map(d => ({ id: d.id, motivo: d.motivo, pax_perdido: d.pax_perdido }))}
        />

        <CampoResponsavel
          value={form.responsavel}
          onChange={responsavel => handleFormChange({ responsavel })}
          disabled={disabled}
          erro={erros.responsavel}
        />
      </div>

      {/* Rodapé: autosave indicator + botão de envio */}
      <div className="space-y-3 pt-2">
        {salvando && (
          <p className="text-center text-xs text-ink-subtle">Salvando rascunho…</p>
        )}
        {!periodoAtualEnviado && !relatorioFechado ? (
          <button
            onClick={handleEnviar}
            disabled={enviando || disabled}
            className="w-full rounded-xl bg-ember py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {enviando ? 'Enviando…' : `Enviar ${PERIODO_LABEL[periodoAtivo] ?? periodoAtivo}`}
          </button>
        ) : periodoAtualEnviado ? (
          <div className="w-full rounded-xl border border-fresh/30 bg-fresh/10 py-3 text-center text-sm font-semibold text-fresh-bright">
            ✓ {PERIODO_LABEL[periodoAtivo]} enviado
          </div>
        ) : null}
        {relatorioFechado && (
          <p className="text-center text-xs text-ink-subtle">
            Todos os períodos enviados — relatório fechado.
          </p>
        )}
      </div>
    </div>
  )
}
