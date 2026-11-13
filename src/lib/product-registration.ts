import { FOOD_CATEGORIES } from '@/lib/shelf-life'
import { isUuid } from '@/lib/business-registration'

export const PRODUCT_CATEGORIES = ['proteina', 'fruta', 'legume', 'verdura', 'graos', 'laticinios', 'panificacao', 'oleo_gordura', 'tempero', 'bebida_alcoolica', 'bebida_nao_alcoolica', 'descartavel', 'limpeza', 'outro'] as const
export const PRODUCT_UNITS = ['kg', 'g', 'l', 'ml', 'un', 'cx', 'fardo', 'duzia'] as const

export function validateProduct(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Cadastro inválido.')
  const body = input as Record<string, unknown>
  const text = (key: string) => typeof body[key] === 'string' ? body[key].trim() : ''
  const nome = text('nome')
  if (!nome || nome.length > 250) throw new Error('Preencha um nome de produto de até 250 caracteres.')
  if (!isUuid(body.group_id)) throw new Error('Selecione um grupo válido.')
  if (!PRODUCT_CATEGORIES.some(value => value === text('categoria'))) throw new Error('Selecione a categoria do produto.')
  const unidade = text('unidade_padrao').toLowerCase()
  if (!PRODUCT_UNITS.some(value => value === unidade)) throw new Error('Selecione uma unidade de medida válida.')
  const sanitaryCategory = text('categoria_anvisa') || null
  if (sanitaryCategory && !FOOD_CATEGORIES.some(value => value.value === sanitaryCategory)) throw new Error('Selecione uma categoria sanitária válida.')
  if (body.fornecedor_id && !isUuid(body.fornecedor_id)) throw new Error('Selecione um fornecedor válido.')
  function numeric(key: string, maximum = Infinity) {
    if (body[key] == null || body[key] === '') return null
    const number = Number(body[key])
    if (!['number', 'string'].includes(typeof body[key]) || !Number.isFinite(number) || number < 0 || number > maximum) throw new Error('Confira o custo e o percentual de perdas.')
    return number
  }
  if (typeof body.ativo !== 'boolean') throw new Error('Informe se o produto está ativo.')
  return { nome, group_id: body.group_id, categoria: text('categoria'), categoria_anvisa: sanitaryCategory, unidade_padrao: unidade, codigo: text('codigo') || null, custo_padrao: numeric('custo_padrao') ?? 0, fornecedor_id: body.fornecedor_id || null, perdas_padrao: numeric('perdas_padrao', 100), observacoes: text('observacoes') || null, ativo: body.ativo }
}
