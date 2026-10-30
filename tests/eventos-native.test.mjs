import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const exports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/eventos/model.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports })

test('valores em reais preservam centavos, zero e não informado', () => {
  for (const [input, expected] of [['', null], ['   ', null], ['0', 0], ['0,00', 0], ['1.250,50', 1250.5], ['1250.50', 1250.5], ['R$ 1.250,50', 1250.5], ['9999999999,99', 9999999999.99]]) assert.equal(exports.parseMoney(input), expected)
  for (const input of ['-1', 'abc', '1,234', '1.000', '1.2.3', 'Infinity', '1e3', '10000000000']) assert.throws(() => exports.parseMoney(input))
  assert.equal(exports.money(null), 'Não informado')
  assert.match(exports.money(0), /0,00/)
})

test('dados operacionais e anexos legados podem ser lidos como JSON ou arrays', () => {
  const data = [{ servico: '_info', descritivo: 'Informações antigas' }]
  assert.equal(JSON.stringify(exports.rows(JSON.stringify(data))), JSON.stringify(data))
  assert.equal(exports.rows(data), data)
  assert.equal(exports.rows(null).length, 0)
})

test('total soma A&B e locação em centavos, distinguindo ausência de zero', () => {
  assert.equal(exports.eventTotal(1250.5, 2500.75), 3751.25)
  assert.equal(exports.eventTotal(0.1, 0.2), 0.3)
  assert.equal(exports.eventTotal(null, null), null)
  assert.equal(exports.eventTotal('', undefined), null)
  assert.equal(exports.eventTotal(0, null), 0)
  assert.equal(exports.eventTotal(null, 150), 150)
  assert.equal(exports.eventTotal(150, null), 150)
  assert.equal(exports.eventTotal('1250.50', '2500.75'), 3751.25)
})
