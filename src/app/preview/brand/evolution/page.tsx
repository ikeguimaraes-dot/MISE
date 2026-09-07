import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import './evolution.css'

export const dynamic = 'force-dynamic'

const versions = [
  { number: '01', name: 'Ritmo', file: '/brand/v1/mise-logo-dark.svg', note: 'Leveza e movimento.', status: 'VERSÃO INICIAL' },
  { number: '02', name: 'Bancada pronta', file: '/brand/v2/mise-logo-dark.svg', note: 'Organização em módulos sólidos.', status: 'VERSÃO ANTERIOR' },
  { number: '03', name: 'M modular', file: '/brand/studies/mise-logo-v3-dark.svg', note: 'Traços leves. Um “m” sugerido pelo conjunto.', status: 'NOVO ESTUDO · NÃO APLICADO' },
]

export default function EvolutionPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <main className="mise-evolution-page">
    <nav><Link href="/preview/brand">← Voltar à identidade</Link><Link href="/preview/brand/wordmark" style={{ marginLeft: 24 }}>Ver estudo 04: assinatura completa →</Link></nav>
    <div className="mise-evolution-board" id="evolution-board">
      <header><span>MISE / ESTUDO DE EVOLUÇÃO</span><span>01 → 02 → 03</span></header>
      <h1>O mesmo princípio.<br /><em>Uma assinatura mais leve.</em></h1>
      <p className="evolution-subtitle">Mise en place — cada coisa no seu lugar.</p>
      <section className="evolution-versions" aria-label="Três versões do logo para comparação">
        {versions.map(version => <article key={version.number}><span className="version-status">{version.status}</span><Image src={version.file} alt={`Logo ${version.number}: ${version.name}`} width={228} height={76} unoptimized /><h2><span>{version.number}</span>{version.name}</h2><p>{version.note}</p></article>)}
      </section>
      <section className="evolution-detail" aria-label="Ampliação do terceiro estudo">
        <div className="evolution-dark"><span>03 / ASSINATURA EM FUNDO ESCURO</span><Image src="/brand/studies/mise-logo-v3-light.svg" alt="Terceiro estudo em linho e brasa" width={400} height={133} unoptimized /></div>
        <div className="evolution-symbol"><span>03 / SÍMBOLO ISOLADO</span><Image src="/brand/studies/mise-symbol-v3.svg" alt="Três elementos separados formando um M modular" width={135} height={108} unoptimized /><p>Intervalos regulares.<br />Curvas suaves. Menos massa visual.</p></div>
      </section>
      <footer><span>HISTÓRICO DOS ESTUDOS</span><p>A assinatura 04.4 foi aprovada e está aplicada na plataforma local.</p></footer>
    </div>
  </main>
}
