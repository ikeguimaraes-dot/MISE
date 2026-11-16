import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as icons from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTs } from './helpers/load-ts.mjs'

const workspace = env => loadTs('src/lib/workspace.ts', {}, env)
const base = {
  'react/jsx-runtime': jsx, react: React, 'lucide-react': icons,
  'next/link': { default: ({ children, prefetch: _prefetch, ...props }) => React.createElement('a', props, children) },
  './mise-brand': { MiseBrand: () => React.createElement('span', null, 'MISE') },
  './theme-toggle': { ThemeToggle: () => null },
}

for (const [scenario, env, name, badge] of [
  ['KPH por padrão', {}, 'KPH Participações', 'KPH'],
  ['Maza', { NEXT_PUBLIC_MISE_WORKSPACE_NAME: 'Maza', NEXT_PUBLIC_MISE_WORKSPACE_BADGE: 'MAZA' }, 'Maza', 'MAZA'],
]) {
  test(`${scenario}: navegação, login, impressão, metadata e manifesto usam a mesma identidade`, async () => {
    const config = workspace(env)
    const dependencies = { ...base, '@/lib/workspace': config }
    const navigation = loadTs('src/components/layout/navigation.ts', { 'lucide-react': icons })
    const { TopNav } = loadTs('src/components/layout/topnav.tsx', {
      ...dependencies, './navigation': navigation,
      'next/navigation': { usePathname: () => '/', useRouter: () => ({}) },
      '@/lib/supabase/client': { createClient: () => { throw new Error('Unexpected database access') } },
      '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    })
    const sidebar = renderToStaticMarkup(React.createElement(TopNav, { preview: true }))
    assert.ok(sidebar.includes(`>${name}</p>`))
    assert.ok(sidebar.includes(`>${badge}</span>`))
    const { AuthShell } = loadTs('src/components/layout/auth-shell.tsx', dependencies)
    const login = renderToStaticMarkup(React.createElement(AuthShell, null, 'Login'))
    assert.ok(login.includes(`>${name}</span>`))
    const brand = loadTs('src/lib/brand.ts', { '@/lib/workspace': config })
    assert.ok(brand.printBrandHeader().includes(`${name.toUpperCase()} · ORKESTRI OPX`))
    assert.ok(brand.printBrandHeader().includes('aria-label="MISE"'))
    assert.ok(brand.printBrandFooter().includes(`MISE · ${name}`))
    const { metadata } = loadTs('src/app/layout.tsx', {
      ...dependencies, './globals.css': {}, './theme.css': {}, '@/lib/theme': { THEME_BOOTSTRAP: '' },
      'next/font/google': { Geist: () => ({ variable: 'sans' }), Geist_Mono: () => ({ variable: 'mono' }) },
    })
    assert.equal(metadata.description, `Operação, rotinas e qualidade em cada unidade — ${name}`)
    assert.equal(metadata.title.default, 'MISE · Orkestri OPX')
    const { GET } = loadTs('src/app/manifest.json/route.ts', { '@/lib/workspace': config })
    const response = GET()
    assert.equal(response.headers.get('Content-Type'), 'application/manifest+json')
    const manifest = await response.json()
    assert.equal(manifest.description, metadata.description)
    assert.equal(manifest.name, 'MISE · Orkestri OPX')
    assert.equal(manifest.short_name, 'MISE')
    if (name === 'Maza') {
      for (const output of [sidebar, login, brand.printBrandHeader(), brand.printBrandFooter(), metadata.description, JSON.stringify(manifest)]) {
        assert.doesNotMatch(output, /KPH/)
      }
    }
  })
}

test('valores vazios usam os padrões e cada variável pode ser configurada independentemente', () => {
  const empty = workspace({ NEXT_PUBLIC_MISE_WORKSPACE_NAME: '  ', NEXT_PUBLIC_MISE_WORKSPACE_BADGE: '' })
  assert.equal(empty.WORKSPACE_NAME, 'KPH Participações')
  assert.equal(empty.WORKSPACE_BADGE, 'KPH')
  const trimmed = workspace({ NEXT_PUBLIC_MISE_WORKSPACE_NAME: ' Maza ', NEXT_PUBLIC_MISE_WORKSPACE_BADGE: ' MAZA ' })
  assert.equal(trimmed.WORKSPACE_NAME, 'Maza')
  assert.equal(trimmed.WORKSPACE_BADGE, 'MAZA')
  assert.equal(workspace({ NEXT_PUBLIC_MISE_WORKSPACE_NAME: 'Maza' }).WORKSPACE_BADGE, 'KPH')
  assert.equal(workspace({ NEXT_PUBLIC_MISE_WORKSPACE_BADGE: 'MAZA' }).WORKSPACE_NAME, 'KPH Participações')
})

test('nome configurado é escapado nos relatórios HTML', () => {
  const config = workspace({ NEXT_PUBLIC_MISE_WORKSPACE_NAME: '<script>"A" & \'B\'</script>' })
  const brand = loadTs('src/lib/brand.ts', { '@/lib/workspace': config })
  assert.ok(brand.printBrandFooter().includes('&lt;script&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/script&gt;'))
  assert.doesNotMatch(brand.printBrandHeader(), /<script>/i)
  assert.doesNotMatch(brand.printBrandFooter(), /<script>/i)
})
