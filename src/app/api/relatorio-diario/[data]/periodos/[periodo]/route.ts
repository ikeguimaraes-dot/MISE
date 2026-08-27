import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ data: string; periodo: string }> }
) {
  const { data: dataParam, periodo } = await params
  const body = await request.json()
  const { unit_id, setores, equipe, ...campos } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: relatorio } = await supabase
    .from('op_relatorio_diario')
    .select('id, status')
    .eq('unit_id', unit_id)
    .eq('data', dataParam)
    .single()

  if (!relatorio) {
    return NextResponse.json({ error: 'Relatório não encontrado. Reabra a página.' }, { status: 404 })
  }
  if (relatorio.status === 'enviado') {
    return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })
  }

  const { data: updated, error } = await supabase
    .from('op_relatorio_periodo')
    .upsert(
      { relatorio_id: relatorio.id, periodo, ...campos },
      { onConflict: 'relatorio_id,periodo' }
    )
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Avaliação de setores — tabela dedicada op_avaliacao_setor (por período).
  // setores chega como { [setor]: { nota: number|null, obs: string } }.
  // Só faz upsert das entradas com nota preenchida; ignora as vazias.
  if (setores && typeof setores === 'object') {
    const linhas = Object.entries(setores as Record<string, { nota: number | null; obs?: string }>)
      .filter(([, av]) => av && av.nota != null)
      .map(([setor, av]) => ({
        relatorio_id: relatorio.id,
        periodo,
        setor,
        nota: av.nota,
        observacao: av.obs?.trim() || null,
      }))
    if (linhas.length > 0) {
      const { error: errSetor } = await supabase
        .from('op_avaliacao_setor')
        .upsert(linhas, { onConflict: 'relatorio_id,periodo,setor' })
      if (errSetor) return NextResponse.json({ error: errSetor.message }, { status: 500 })
    }
  }

  // Equipe por setor — tabela op_falta_equipe (por período, chave area).
  // equipe chega como [{ area, lider_turno, houve_falta, nomes }].
  // Upserta as linhas com líder OU falta preenchidos.
  if (Array.isArray(equipe)) {
    const linhas = (equipe as { area: string; lider_turno: string | null; houve_falta: boolean; nomes: string | null }[])
      .filter(e => e.area && (e.lider_turno || e.houve_falta || e.nomes))
      .map(e => ({
        relatorio_id: relatorio.id,
        periodo,
        area: e.area,
        lider_turno: e.lider_turno ?? null,
        houve_falta: e.houve_falta ?? false,
        nomes: e.nomes ?? null,
      }))
    if (linhas.length > 0) {
      const { error: errFalta } = await supabase
        .from('op_falta_equipe')
        .upsert(linhas, { onConflict: 'relatorio_id,periodo,area' })
      if (errFalta) return NextResponse.json({ error: errFalta.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: updated.id })
}
