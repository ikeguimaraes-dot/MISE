// ROTA TEMPORÁRIA — deletar após introspecção do Sprint 0
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  const diagnosis = {
    url_set: url.length > 0,
    url_starts_with_https: url.startsWith('https://'),
    url_length: url.length,
    url_prefix: url.slice(0, 12),          // mostra só "https://xyz." sem revelar projeto
    svc_key_set: svcKey.length > 0,
    svc_key_length: svcKey.length,
    anon_key_set: anonKey.length > 0,
  }

  if (!url.startsWith('https://')) {
    return NextResponse.json({ diagnosis, error: 'NEXT_PUBLIC_SUPABASE_URL inválida ou vazia' }, { status: 500 })
  }

  // URL válida — tentar conexão real
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = createServiceClient()

  const tables = [
    'op_relatorio_diario', 'op_periodo', 'op_86', 'op_feedback_cliente',
    'op_portaria', 'op_portaria_desistencia', 'op_enxoval',
    'op_ocorrencia_rh', 'op_pendura', 'op_conta_assinada',
    'op_unit_config', 'employees',
  ]

  const results: Record<string, unknown> = {}
  for (const t of tables) {
    const { data, error } = await (supabase.from(t as never).select('*').limit(3)) as {
      data: Record<string, unknown>[] | null
      error: { message: string } | null
    }
    if (error) {
      results[t] = { error: error.message }
    } else if (!data || data.length === 0) {
      results[t] = { cols: [], rows: 0, note: 'tabela vazia' }
    } else {
      results[t] = { cols: Object.keys(data[0]), rows: data.length, sample: data[0] }
    }
  }

  const { data: motivos86 } = await supabase.from('op_86').select('motivo').limit(200)
  const motivosUnicos = [...new Set((motivos86 ?? []).map((r: { motivo: string }) => r.motivo))].filter(Boolean)
  const { data: unitConfigs } = await supabase.from('op_unit_config').select('*')

  return NextResponse.json({ diagnosis, tables: results, op_86_motivos: motivosUnicos, unit_configs: unitConfigs })
}
