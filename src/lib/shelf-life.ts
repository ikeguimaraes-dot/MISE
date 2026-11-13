// Perfil de São Paulo: CVS 5/2013, art. 34. Ver docs/validade-etiquetas.md.
export const SHELF_LIFE_REFERENCE = 'CVS 5/2013 · art. 34'

export const FOOD_CATEGORIES = [
  { value: 'proteina_animal_cozida', label: 'Carnes e aves cozidas', hours: 72, maxTemperature: 4 },
  { value: 'proteina_animal_crua', label: 'Carnes e aves cruas manipuladas', hours: 72, maxTemperature: 4 },
  { value: 'carne_preparada_crua', label: 'Carnes temperadas, moídas, empanadas, espetos e bife rolê crus', hours: 48, maxTemperature: 4 },
  { value: 'pescado_cru', label: 'Pescados crus manipulados', hours: 72, maxTemperature: 2 },
  { value: 'pescado_cozido', label: 'Pescados pós-cocção', hours: 24, maxTemperature: 2 },
  { value: 'frios_embutidos', label: 'Frios e embutidos fatiados, picados ou moídos', hours: 72, maxTemperature: 4 },
  { value: 'maionese', label: 'Maionese e misturas com maionese', hours: 48, maxTemperature: 4 },
  { value: 'vegetal_cozido', label: 'Vegetais cozidos', hours: 72, maxTemperature: 4 },
  { value: 'vegetal_cru', label: 'Frutas e vegetais higienizados ou fracionados; sucos e polpas', hours: 72, maxTemperature: 5 },
  { value: 'arroz_massa_cereais', label: 'Arroz, massas e cereais cozidos', hours: 72, maxTemperature: 4 },
  { value: 'molho_caldo', label: 'Molhos e caldos cozidos (sem pescado ou maionese)', hours: 72, maxTemperature: 4 },
  { value: 'laticinios', label: 'Preparações com laticínios', hours: 72, maxTemperature: 4 },
  { value: 'sobremesa', label: 'Sobremesas e confeitaria com recheio ou cobertura', hours: 72, maxTemperature: 4 },
  { value: 'fritura', label: 'Frituras prontas (exceto pescados)', hours: 72, maxTemperature: 4 },
] as const

export const CONSERVATION_METHODS = [
  { value: 'Refrigerado até 2°C', maxTemperature: 2 },
  { value: 'Refrigerado até 4°C', maxTemperature: 4 },
  { value: 'Refrigerado até 5°C', maxTemperature: 5 },
  { value: 'Congelado de 0 a -5°C', hours: 240, maxTemperature: 0 },
  { value: 'Congelado de -6 a -10°C', hours: 480, maxTemperature: -6 },
  { value: 'Congelado de -11 a -18°C', hours: 720, maxTemperature: -11 },
  { value: 'Congelado -18°C', hours: 720, maxTemperature: -18 },
  { value: 'Congelado abaixo de -18°C', hours: 2160, maxTemperature: -18.01 },
  { value: 'Temperatura ambiente' },
] as const

export type ShelfLifeRule = {
  prazo_horas: number
  source: 'cvs' | 'custom'
  reference: string
}

export function getDefaultConservationMethod(category: string | null | undefined): string {
  const food = FOOD_CATEGORIES.find(item => item.value === category)
  return food ? `Refrigerado até ${food.maxTemperature}°C` : ''
}

export function getShelfLifeRule(category: string | null | undefined, method: string, customHours?: number | null): ShelfLifeRule {
  // Os rótulos antigos permanecem interpretáveis, sem ampliar seu limite térmico.
  const legacyMethods: Record<string, string> = {
    'Resfriado 0-5°C': 'Refrigerado até 5°C',
    'Refrigerado 5-10°C': 'Refrigerado 5-10°C',
  }
  const normalized = legacyMethods[method] ?? method
  if (normalized === 'Temperatura ambiente') throw new Error('Temperatura ambiente não possui prazo genérico. Escolha refrigeração ou congelamento; produtos estáveis exigem orientação específica do responsável técnico.')
  const food = FOOD_CATEGORIES.find(item => item.value === category)
  if (!food) throw new Error('Selecione a categoria sanitária do produto para calcular a validade.')
  const conservation = CONSERVATION_METHODS.find(item => item.value === normalized)
  if (!conservation) throw new Error('Método sem prazo automático seguro. Selecione uma das faixas de temperatura disponíveis.')
  let hours: number
  if ('hours' in conservation) {
    const postCooking = ['proteina_animal_cozida', 'pescado_cozido', 'vegetal_cozido', 'arroz_massa_cereais', 'molho_caldo', 'fritura']
    if (postCooking.includes(food.value) && conservation.maxTemperature > -18) throw new Error('Alimentos pós-cocção devem ser congelados a -18 °C ou menos (RDC 216/2004, item 4.8.16). Selecione -18 °C ou abaixo de -18 °C.')
    hours = conservation.hours
  }
  else if ('maxTemperature' in conservation) {
    if (conservation.maxTemperature > food.maxTemperature) throw new Error(`Esta categoria exige refrigeração de no máximo ${food.maxTemperature} °C. Selecione uma temperatura compatível.`)
    hours = food.hours
  } else throw new Error('Método sem regra de validade.')
  const useCustom = typeof customHours === 'number' && Number.isFinite(customHours) && customHours > 0 && customHours < hours
  return { prazo_horas: useCustom ? customHours : hours, source: useCustom ? 'custom' : 'cvs', reference: SHELF_LIFE_REFERENCE }
}

export function calculateExpiry(manipulation: string, hours: number, supplierExpiry?: string | null): string {
  // Datetimes sem offset vêm do formulário e representam America/Sao_Paulo.
  const withOffset = /(?:Z|[+-]\d{2}:\d{2})$/.test(manipulation) ? manipulation : `${manipulation}-03:00`
  const start = new Date(withOffset).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(hours) || hours <= 0) throw new Error('Data de manipulação ou prazo inválido.')
  let end = start + hours * 3_600_000
  if (supplierExpiry) {
    const supplier = new Date(/^\d{4}-\d{2}-\d{2}$/.test(supplierExpiry) ? `${supplierExpiry}T23:59:59.999-03:00` : supplierExpiry).getTime()
    if (!Number.isFinite(supplier) || supplier <= start) throw new Error('A validade do fornecedor deve ser posterior à manipulação.')
    end = Math.min(end, supplier)
  }
  return new Date(end).toISOString()
}

export function expiryToLocalInput(iso: string): string {
  const date = new Date(new Date(iso).getTime() - 3 * 3_600_000)
  return date.toISOString().slice(0, 16)
}
