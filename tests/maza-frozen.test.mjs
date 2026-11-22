import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'
const business = loadTs('src/lib/business-registration.ts')
function profile(badge) {
  const env = { NEXT_PUBLIC_MISE_WORKSPACE_BADGE: badge }
  const shelf = loadTs('src/lib/shelf-life.ts', {}, env)
  const products = loadTs('src/lib/product-registration.ts', { '@/lib/shelf-life': shelf, '@/lib/business-registration': business }, env)
  return { shelf, products }
}
const category = 'congelados_30_dias'
const product = { nome: 'Gyoza suína', group_id: '11111111-1111-4111-8111-111111111111', categoria: category, categoria_anvisa: category, unidade_padrao: 'kg', metodo_conservacao: 'Congelado -18°C', ativo: true }

test('congelados 30 dias só aparece no perfil Maza e é rejeitado no cadastro e cálculo KPH', () => {
  for (const badge of [undefined, '', 'KPH', 'Outra']) {
    const { shelf, products } = profile(badge)
    assert.equal(shelf.FOOD_CATEGORIES.some(c => c.value === category), false)
    assert.equal(products.PRODUCT_CATEGORIES.includes(category), false)
    assert.equal(shelf.getDefaultConservationMethod(category), '')
    assert.throws(() => products.validateProduct(product), /categoria/)
    assert.throws(() => products.validateProduct({ ...product, categoria: 'proteina' }), /categoria sanitária/)
    assert.throws(() => shelf.getShelfLifeRule(category, 'Congelado -18°C'), /categoria/)
  }
})

test('Maza oferece categoria comercial e sanitária com padrão -18°C e 720 horas', () => {
  for (const badge of ['MAZA', ' Maza ']) {
    const { shelf, products } = profile(badge)
    assert.equal(products.PRODUCT_CATEGORIES.includes(category), true)
    assert.ok(shelf.FOOD_CATEGORIES.find(c => c.value === category))
    assert.equal(shelf.getDefaultConservationMethod(category), 'Congelado -18°C')
    assert.equal(products.validateProduct(product).metodo_conservacao, 'Congelado -18°C')
    for (const method of ['Congelado -18°C', 'Congelado abaixo de -18°C']) {
      const rule = shelf.getShelfLifeRule(category, method)
      assert.equal(rule.prazo_horas, 720)
      assert.equal(rule.source, 'operational')
      assert.match(rule.reference, /Maza/)
      assert.equal(shelf.getShelfLifeRule(category, method, 48).prazo_horas, 48)
      assert.equal(shelf.getShelfLifeRule(category, method, 2160).prazo_horas, 720)
    }
  }
})

test('Maza exige congelamento a -18°C ou menos e mantém fornecedor como limite', () => {
  const { shelf, products } = profile('MAZA')
  for (const method of ['', 'Temperatura ambiente', 'Refrigerado até 2°C', 'Congelado de -6 a -10°C', 'Congelado de -11 a -18°C']) {
    assert.throws(() => shelf.getShelfLifeRule(category, method), /-18/)
    if (method) assert.throws(() => products.validateProduct({ ...product, metodo_conservacao: method }), /-18/)
  }
  const start = '2026-12-15T10:15:00-03:00'
  assert.equal(shelf.calculateExpiry(start, 720), '2027-01-14T13:15:00.000Z')
  assert.equal(shelf.calculateExpiry(start, 720, '2026-12-20'), '2026-12-21T02:59:59.999Z')
})

test('cálculo do produto Maza usa padrão cadastrado mesmo com método injetado e conserva prazo menor existente', async () => {
  const { shelf } = profile('MAZA')
  const db = { schema() { return this }, from(table) {
    return { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: table === 'ingredients' ? { ...product, prazo_validade_horas: 720 } : { prazo_horas: 240 } }) }
  } }
  const server = loadTs('src/lib/shelf-life-server.ts', { '@/lib/shelf-life': shelf, '@/lib/supabase/server': { createServiceClient: () => db } })
  const rule = await server.resolveShelfLifeRule({ method: 'Temperatura ambiente', ingredientId: 'product', category: 'outro' })
  assert.equal(rule.prazo_horas, 240)
})

test('formulário do Maza exibe categoria e conservação; formulário KPH não oferece a categoria', async () => {
  const React = await import('react')
  const jsx = await import('react/jsx-runtime')
  const { renderToStaticMarkup } = await import('react-dom/server')
  for (const badge of ['MAZA', 'KPH']) {
    const { shelf, products } = profile(badge)
    const { ProdutoForm } = loadTs('src/app/(dashboard)/cadastros/produtos/_components/produto-form.tsx', {
      react: React, 'react/jsx-runtime': jsx, 'next/navigation': { useRouter: () => ({}) }, '@/lib/shelf-life': shelf, '@/lib/product-registration': products,
    })
    const html = renderToStaticMarkup(React.createElement(ProdutoForm, { isAdmin: true, groups: [], suppliers: [], initial: { ...product, id: product.group_id, prazo_validade_horas: 720 } }))
    assert.equal(html.includes('value="congelados_30_dias"'), badge === 'MAZA')
    if (badge === 'MAZA') {
      assert.match(html, /Congelados \(30 dias\)/)
      assert.match(html, /Prazo aplicado: 720h/)
    }
  }
})
