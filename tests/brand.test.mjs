import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8').trim()
const approved = tone => read(`public/brand/studies/mise-wordmark-v4-${tone}.svg`)
const normalize = svg => svg.replace(/aria-label="[^"]+"/, 'aria-label="MISE"')
const master = tone => read(`public/brand/mise-logo-${tone}.svg`)

test('active logos match the approved 04.4 geometry and colors', () => {
  for (const tone of ['dark', 'light', 'mono']) {
    assert.equal(master(tone), normalize(approved(tone)))
    assert.match(master(tone), /<rect x="97" y="24" width="4" height="4"/)
    assert.doesNotMatch(master(tone), /<rect x="41" y="-1"/)
  }
  assert.equal(master('white'), normalize(approved('mono').replaceAll('#171716', '#FAF6F0')))
  for (const tone of ['dark', 'light']) {
    assert.match(master(tone), /data-letter="m" fill="#F47748"/)
  }
})

test('seals and inline report header carry the approved monochrome signature', () => {
  for (const [file, tone] of [['orange', 'orange'], ['mono', 'mono']]) {
    const seal = read(`public/brand/mise-seal-${file}.svg`)
    assert.ok(seal.includes(normalize(approved(tone)).replace('<svg ', '<svg x="63" y="116" width="194" height="66" ')))
    assert.doesNotMatch(seal, /mise-en-place-v2/)
  }
  const printLine = read('src/lib/brand.ts').split('\n').find(line => line.startsWith('const PRINT_LOGO = '))
  const printSvg = JSON.parse(printLine.slice('const PRINT_LOGO = '.length))
  assert.equal(printSvg, master('mono').replace('<svg ', '<svg width="86" height="31" '))
})

test('compact icon uses the same M and manifest assets exist', () => {
  const m = master('dark').match(/<g data-letter="m"[^>]*>([\s\S]*?)<\/g>/)[1]
  assert.ok(read('public/brand/mise-symbol.svg').includes(m))
  assert.ok(read('public/icons/mise-mark.svg').includes(m))
  const manifest = JSON.parse(read('public/manifest.json'))
  for (const icon of manifest.icons) {
    const pathname = new URL(icon.src, 'http://localhost').pathname
    assert.ok(existsSync(fileURLToPath(new URL(`public${pathname}`, root))))
  }
})
