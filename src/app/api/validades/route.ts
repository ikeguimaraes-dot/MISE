import { NextResponse } from 'next/server'
import { getMiseSession } from '@/lib/session'
import { isUuid } from '@/lib/business-registration'
import { VALIDITY_CARDS, type ValidityBucket } from '@/lib/label-validities'
import { loadValidities } from '@/lib/label-validities-server'

export async function GET(request: Request) {
  if (!await getMiseSession()) return NextResponse.json({ error: 'Sua sessão expirou. Entre novamente.' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const unit = params.get('unit') || ''
  const bucket = params.get('bucket') || ''
  const page = Number(params.get('page') || '1')
  if ((unit && !isUuid(unit)) || (bucket && !VALIDITY_CARDS.some(card => card.key === bucket)) || !Number.isSafeInteger(page) || page < 1) return NextResponse.json({ error: 'Filtro inválido.' }, { status: 400 })
  try { return NextResponse.json(await loadValidities({ unit, bucket: bucket as ValidityBucket, page }), { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível carregar as validades.' }, { status: 500 }) }
}
