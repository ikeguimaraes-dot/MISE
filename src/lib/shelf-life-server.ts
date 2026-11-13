import { createServiceClient } from '@/lib/supabase/server'
import { getShelfLifeRule } from '@/lib/shelf-life'

export async function resolveShelfLifeRule({ method, category, ingredientId, manufacturerHours }: { method: string; category?: string | null; ingredientId?: string | null; manufacturerHours?: number | null }) {
  if (!ingredientId) return getShelfLifeRule(category, method, null, manufacturerHours)
  const supabase = createServiceClient()
  const [product, custom] = await Promise.all([
    supabase.from('ingredients').select('categoria_anvisa').eq('id', ingredientId).eq('ativo', true).maybeSingle(),
    supabase.schema('mise').from('ingredient_shelf_life').select('prazo_horas').eq('ingredient_id', ingredientId).eq('metodo_conservacao', method).maybeSingle(),
  ])
  if (product.error || custom.error) throw new Error('Não foi possível consultar as regras do produto. Tente novamente.')
  if (!product.data) throw new Error('Produto não encontrado ou inativo.')
  // O cadastro prevalece. Produtos sem categoria podem ser classificados na emissão.
  return getShelfLifeRule(product.data.categoria_anvisa || category, method, custom.data ? Number(custom.data.prazo_horas) : null, manufacturerHours)
}
