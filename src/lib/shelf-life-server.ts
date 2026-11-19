import { createServiceClient } from '@/lib/supabase/server'
import { getShelfLifeRule } from '@/lib/shelf-life'

export type ProductShelfLifeSettings = { categoria_anvisa: string | null; metodo_conservacao: string | null; prazo_validade_horas: number | null }

export async function resolveShelfLifeRule({ method, category, ingredientId, manufacturerHours, productSettings }: { method: string; category?: string | null; ingredientId?: string | null; manufacturerHours?: number | null; productSettings?: ProductShelfLifeSettings }) {
  if (!ingredientId) return getShelfLifeRule(category, method, null, manufacturerHours)
  const supabase = createServiceClient()
  const product = productSettings ? { data: productSettings, error: null } : await supabase.from('ingredients').select('categoria_anvisa, metodo_conservacao, prazo_validade_horas').eq('id', ingredientId).eq('ativo', true).maybeSingle()
  if (product.error) throw new Error('Não foi possível consultar as regras do produto. Tente novamente.')
  if (!product.data) throw new Error('Produto não encontrado ou inativo.')
  const savedMethod = product.data.metodo_conservacao || method
  const custom = await supabase.schema('mise').from('ingredient_shelf_life').select('prazo_horas').eq('ingredient_id', ingredientId).eq('metodo_conservacao', savedMethod).maybeSingle()
  if (custom.error) throw new Error('Não foi possível consultar as regras do produto. Tente novamente.')
  const savedHours = product.data.prazo_validade_horas == null ? null : Number(product.data.prazo_validade_horas)
  const limits = [savedHours, custom.data ? Number(custom.data.prazo_horas) : null].filter((hours): hours is number => hours !== null)
  return getShelfLifeRule(product.data.categoria_anvisa || category, savedMethod, limits.length ? Math.min(...limits) : null, savedHours ?? manufacturerHours)
}
