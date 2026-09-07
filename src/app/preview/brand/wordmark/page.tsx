import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import './wordmark.css'

export const dynamic = 'force-dynamic'

function Wordmark({ tone = 'dark' }: { tone?: 'dark' | 'light' | 'orange' | 'mono' }) {
  return <Image src={`/brand/studies/mise-wordmark-v4-${tone}.svg`} width={540} height={195} alt="mise. — letras alinhadas e espaçamento refinado" unoptimized />
}

export default function WordmarkPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <main className="wordmark-page">
    <nav><Link href="/preview/brand/evolution">← Estudos anteriores</Link><a href="/brand/studies/mise-wordmark-v4-dark.svg" download>Baixar estudo em SVG</a></nav>
    <div className="wordmark-board" id="wordmark-board">
      <header><span>MISE / EVOLUÇÃO DA ASSINATURA</span><span>APROVADA / 04.4</span></header>
      <section className="wordmark-heading"><h1>Do começo<br /><em>ao ponto final.</em></h1><p>M e ponto em brasa.<br />O mesmo desenho, ainda sem o pingo do i.</p></section>
      <section className="wordmark-hero" aria-label="Nova assinatura tipográfica"><span>04.4 / PONTO MAIS PRÓXIMO DO E</span><Wordmark tone="light" /><p>CADA COISA NO SEU LUGAR.</p></section>
      <section className="wordmark-comparison wordmark-refinement" aria-label="Comparação antes e depois do ajuste, na mesma escala">
        <article><span>ANTES / 04.3</span><div><Image src="/brand/studies/archive-v4-3/mise-wordmark-v4-dark.svg" width={540} height={195} alt="Versão anterior com o ponto mais afastado do e" unoptimized /></div><p>Espaçamento anterior.</p></article>
        <article><span>AGORA / 04.4</span><div><Wordmark /></div><p>Ponto mais próximo do e. Restante preservado.</p></article>
      </section>
      <section className="wordmark-uses" aria-label="Variações e redução">
        <article className="wordmark-one-color"><span>UMA COR</span><Wordmark tone="mono" /></article>
        <article className="wordmark-icon"><span>ÍCONE INDEPENDENTE</span><div><Image src="/brand/studies/mise-symbol-v3.svg" width={70} height={56} alt="M modular isolado como ícone" unoptimized /></div></article>
        <article className="wordmark-small"><span>EM TAMANHO REDUZIDO</span><div><Wordmark /></div><p>Mesma espessura, curvas suaves<br />e espaços que deixam o nome respirar.</p></article>
      </section>
      <footer><span>MISE EN PLACE / PREPARAR · ORGANIZAR · SERVIR</span><p>Identidade aprovada e aplicada na plataforma local.</p></footer>
    </div>
  </main>
}
