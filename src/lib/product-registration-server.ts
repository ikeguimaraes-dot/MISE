import { NextResponse } from 'next/server'
import { requireMiseRole } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/business-registration'
import { validateProduct } from '@/lib/product-registration'

export async function saveProduct(request: Request, id?: string) {
  if (!await requireMiseRole(['admin', 'gerente'])) return NextResponse.json({ error: 'Sem permissão para cadastrar produtos.' }, { status: 403 })
  if (id && !isUuid(id)) return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
  let data: ReturnType<typeof validateProduct>
  try { data = validateProduct(await request.json()) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Confira os dados do produto.' }, { status: 400 }) }
  const table = createServiceClient().from('ingredients')
  const result = id ? await table.update(data).eq('id', id).select('id').maybeSingle() : await table.insert(data).select('id').single()
  if (result.error) return NextResponse.json({ error: result.error.code === '23505' ? 'Já existe um produto com esses dados.' : 'Não foi possível salvar o produto. Confira o grupo, o fornecedor e os campos obrigatórios.' }, { status: 400 })
  if (!result.data) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
  return NextResponse.json({ id: result.data.id }, { status: id ? 200 : 201 })
}
