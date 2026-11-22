import { MAZA_FROZEN_ENABLED, FOOD_CATEGORIES, CONSERVATION_METHODS, getShelfLifeRule } from '@/lib/shelf-life'
import { isUuid } from '@/lib/business-registration'

export const PRODUCT_CATEGORIES = [...(MAZA_FROZEN_ENABLED ? ['congelados_30_dias' as const] : []), 'molhos', 'ovos', 'shari', 'feitos_empanados', 'proteina', 'fruta', 'legume', 'verdura', 'graos', 'laticinios', 'panificacao', 'oleo_gordura', 'tempero', 'bebida_alcoolica', 'bebida_nao_alcoolica', 'descartavel', 'limpeza', 'outro'] as const
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
  const sif = text('sif') || null
  const marca = text('marca') || null
  if (sif && !/^[A-Za-z0-9][A-Za-z0-9 ./-]{0,29}$/.test(sif)) throw new Error('Informe um registro SIF de até 30 caracteres, sem símbolos especiais.')
  if (marca && (marca.length > 120 || /[\u0000-\u001f]/.test(marca))) throw new Error('Informe uma marca de até 120 caracteres.')
  const lote = text('lote') || null
  if (lote && (lote.length > 80 || /[\u0000-\u001f]/.test(lote))) throw new Error('Informe um lote de até 80 caracteres.')
  const metodo = text('metodo_conservacao') || null
  if (metodo && !CONSERVATION_METHODS.some(item => item.value === metodo)) throw new Error('Selecione um método de conservação válido.')
  const rawHours = body.prazo_validade_horas
  const prazo = rawHours == null || rawHours === '' ? null : Number(rawHours)
  if (prazo !== null && (!['number', 'string'].includes(typeof rawHours) || !Number.isFinite(prazo) || prazo <= 0 || prazo > 87600)) throw new Error('Informe um prazo positivo de até 87600 horas.')
  const sanitaryCategory = text('categoria_anvisa') || null
  if (sanitaryCategory && !FOOD_CATEGORIES.some(value => value.value === sanitaryCategory)) throw new Error('Selecione uma categoria sanitária válida.')
  if (metodo) getShelfLifeRule(sanitaryCategory, metodo, prazo, prazo)
  else if (prazo !== null) throw new Error('Selecione a conservação para definir o prazo.')
  if (body.fornecedor_id && !isUuid(body.fornecedor_id)) throw new Error('Selecione um fornecedor válido.')
  function numeric(key: string, maximum = Infinity) {
    if (body[key] == null || body[key] === '') return null
    const number = Number(body[key])
    if (!['number', 'string'].includes(typeof body[key]) || !Number.isFinite(number) || number < 0 || number > maximum) throw new Error('Confira o custo e o percentual de perdas.')
    return number
  }
  if (typeof body.ativo !== 'boolean') throw new Error('Informe se o produto está ativo.')
  return { nome, sif, marca, lote, metodo_conservacao: metodo, prazo_validade_horas: prazo, group_id: body.group_id, categoria: text('categoria'), categoria_anvisa: sanitaryCategory, unidade_padrao: unidade, codigo: text('codigo') || null, custo_padrao: numeric('custo_padrao') ?? 0, fornecedor_id: body.fornecedor_id || null, perdas_padrao: numeric('perdas_padrao', 100), observacoes: text('observacoes') || null, ativo: body.ativo }
}
