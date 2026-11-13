import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMiseRole } from '@/lib/session'
import { formatCnpj, isUuid, validateBusinessRegistration, type BusinessKind } from '@/lib/business-registration'

export async function saveBusinessRegistration(request: Request, kind: BusinessKind, id?: string) {
  if (!await requireMiseRole(['admin'])) return NextResponse.json({ error: 'Apenas administradores podem gerenciar empresas e unidades.' }, { status: 403 })
  if (id && !isUuid(id)) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 })
  let data: ReturnType<typeof validateBusinessRegistration>
  try { data = validateBusinessRegistration(await request.json(), kind) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Cadastro inválido.' }, { status: 400 }) }
  const db = createServiceClient()
  const table = kind === 'empresa' ? db.schema('mise').from('companies') : db.from('units')
  if (kind === 'unidade') {
    const company = await db.schema('mise').from('companies').select('id').eq('id', data.company_id).maybeSingle()
    if (company.error) return NextResponse.json({ error: 'Não foi possível consultar a empresa.' }, { status: 500 })
    if (!company.data) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 400 })
    // Inclui unidades legadas, cujo CNPJ pode estar armazenado com pontuação.
    let duplicateQuery = db.from('units').select('id').in('cnpj', [data.cnpj, formatCnpj(data.cnpj)])
    if (id) duplicateQuery = duplicateQuery.neq('id', id)
    const duplicate = await duplicateQuery.limit(1)
    if (duplicate.error) return NextResponse.json({ error: 'Não foi possível conferir o CNPJ da unidade.' }, { status: 500 })
    if (duplicate.data?.length) return NextResponse.json({ error: 'Já existe uma unidade com este CNPJ. Edite o cadastro existente.' }, { status: 409 })
  }
  const result = id ? await table.update(data).eq('id', id).select('id').maybeSingle() : await table.insert(data).select('id').single()
  if (result.error) return NextResponse.json({ error: result.error.code === '23505' ? 'Já existe um cadastro com este CNPJ.' : 'Não foi possível salvar o cadastro. Confira os dados e tente novamente.' }, { status: result.error.code === '23505' ? 409 : 400 })
  if (!result.data) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
  return NextResponse.json({ id: result.data.id }, { status: id ? 200 : 201 })
}
