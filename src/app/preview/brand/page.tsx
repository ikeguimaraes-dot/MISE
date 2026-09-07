import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Download } from 'lucide-react'
import './brand.css'

export const dynamic = 'force-dynamic'

const assets = [
  { file: 'mise-logo-light.svg', name: 'Logo · fundo escuro' },
  { file: 'mise-logo-dark.svg', name: 'Logo · fundo claro' },
  { file: 'mise-logo-mono.svg', name: 'Logo · monocromático' },
  { file: 'mise-logo-white.svg', name: 'Logo · branco' },
  { file: 'mise-symbol.svg', name: 'Símbolo' },
  { file: 'mise-seal-orange.svg', name: 'Selo · brasa' },
  { file: 'mise-seal-mono.svg', name: 'Selo · monocromático' },
]

function Logo({ tone = 'light', className = '' }: { tone?: 'light' | 'dark' | 'mono' | 'white'; className?: string }) {
  return <Image className={className} src={`/brand/mise-logo-${tone}.svg`} alt="MISE" width={216} height={78} unoptimized />
}

export default function BrandPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <main className="brand-guide" id="main-content">
    <div className="brand-guide-top" data-no-print><Link href="/preview"><ArrowLeft size={14} />Voltar à plataforma</Link><Link href="/preview/brand/evolution">Comparar evolução: 01 · 02 · 03<ArrowUpRight size={14} /></Link><a href="#brand-files">Arquivos da marca<Download size={14} /></a></div>
    <div className="brand-sheet" id="identity-board">
      <header className="brand-sheet-header"><Logo tone="dark" /><span>IDENTIDADE APROVADA <b>/ 04.4</b></span></header>
      <section className="brand-intro"><div><p className="brand-kicker">MISE VEM DE MISE EN PLACE.</p><h1>Cada coisa<br /><em>no seu lugar.</em></h1></div><p>Preparar. Organizar. Deixar tudo pronto.<br />O cuidado que começa antes do serviço<br />e acompanha toda a operação.</p></section>

      <section className="brand-evolution" aria-label="Comparação entre o logo anterior e a identidade aprovada">
        <div className="brand-evolution-before"><span className="brand-kicker">02 / VERSÃO ANTERIOR</span><Image src="/brand/v2/mise-logo-dark.svg" alt="Logo anterior com três módulos sólidos" width={228} height={76} unoptimized /><p>Símbolo e nome separados.</p></div>
        <div className="brand-evolution-after"><span className="brand-kicker">04.4 / APROVADA E APLICADA NO LOCALHOST</span><Logo tone="dark" /><p>Uma assinatura tipográfica, do m ao ponto final.</p></div>
      </section>
      <section className="brand-origin" aria-label="Conceito da identidade aprovada"><span className="brand-kicker">CADA TRAÇO NO SEU LUGAR</span><p>O m modular dá origem ao desenho do nome inteiro. Traços consistentes, curvas suaves e espaços ajustados traduzem organização em uma assinatura leve e tecnológica.</p><p>M e ponto final em brasa. I sem pingo. Letras na mesma base. O m também funciona sozinho como ícone, sem repetir o símbolo ao lado do nome.</p></section>

      <section className="brand-logo-grid" aria-label="Logo principal e versões">
        <div className="brand-primary-logo"><span className="brand-tile-label">01 / ASSINATURA PRINCIPAL</span><Logo /><span className="brand-tile-foot">MISE · ORKESTRI OPX</span></div>
        <div className="brand-logo-variants"><div className="brand-light-logo"><span className="brand-tile-label">VERSÃO CLARA</span><Logo tone="dark" /></div><div className="brand-mono-logo"><span className="brand-tile-label">UMA COR. A MESMA IDENTIDADE.</span><Logo tone="mono" /></div></div>
      </section>

      <section className="brand-parts-grid">
        <div className="brand-symbol-tile"><span className="brand-tile-label">02 / SÍMBOLO</span><Image src="/brand/mise-symbol.svg" alt="M modular extraído da assinatura MISE" width={170} height={136} unoptimized /><p>O próprio m, como assinatura compacta.</p></div>
        <div className="brand-seal-tile"><span className="brand-tile-label">03 / SELO DE MARCA</span><Image src="/brand/mise-seal-orange.svg" alt="Selo circular MISE: preparar, organizar, servir" width={228} height={228} unoptimized /><p>O cuidado começa antes do serviço.</p></div>
        <div className="brand-type-tile"><span className="brand-tile-label">04 / VOZ VISUAL</span><strong>Aa<span>.</span></strong><h2>Clareza na operação.<br /><em>Calor na experiência.</em></h2><p>Geist para a informação.<br />Serifa editorial para o lado humano.</p></div>
      </section>

      <section className="brand-palette" aria-label="Paleta de cores"><div style={{ background: '#171716', color: '#FAF6F0' }}><b>CARVÃO</b><span>#171716</span></div><div style={{ background: '#F47748', color: '#171716' }}><b>BRASA</b><span>#F47748</span></div><div style={{ background: '#FAF6F0', color: '#171716' }}><b>LINHO</b><span>#FAF6F0</span></div><div style={{ background: '#A4B098', color: '#171716' }}><b>SÁLVIA</b><span>#A4B098</span></div></section>

      <div className="brand-section-title"><h2>A marca em ação.</h2><span>05 / APLICAÇÕES</span></div>
      <section className="brand-applications">
        <figure><div className="brand-app-screen"><div className="brand-browser-bar"><i /><i /><i /><span>mise / operação</span></div><Image src="/brand/mise-platform-preview.png" width={1100} height={800} alt="Captura da nova central operacional MISE" unoptimized /><div className="brand-app-icon"><Image src="/icons/mise-192.png" alt="Ícone MISE" width={64} height={64} unoptimized /><span>mise.</span></div></div><figcaption><b>Plataforma & aplicativo</b><span>Interface, navegação e ícone.</span></figcaption></figure>
        <figure><div className="brand-paper-scene"><div className="brand-paper"><div className="brand-paper-head"><Logo tone="mono" /><span>KPH / OPERAÇÃO</span></div><p className="brand-paper-eyebrow">REGISTRO DA OPERAÇÃO</p><h3>O dia, em<br />cada detalhe.</h3><div className="brand-paper-rule" /><p className="brand-paper-label">RELATÓRIO OPERACIONAL</p><div className="brand-paper-lines"><i /><i /><i /><i /></div><Image src="/brand/mise-seal-mono.svg" width={72} height={72} alt="Selo monocromático em papel" unoptimized /><span className="brand-paper-foot">MISE · ORKESTRI OPX</span></div></div><figcaption><b>Documentos & relatórios</b><span>Assinatura limpa, inclusive em preto e branco.</span></figcaption></figure>
        <figure><div className="brand-package-scene"><div className="brand-package"><div className="brand-package-band"><Logo /><span>CADA COISA<br />NO SEU LUGAR.</span></div><Image src="/brand/mise-seal-mono.svg" width={125} height={125} alt="Exemplo de selo de marca sobre embalagem kraft" unoptimized /></div></div><figcaption><b>Adesivos & materiais da operação</b><span>Selo de marca; não é certificação de inspeção.</span></figcaption></figure>
      </section>
      <footer className="brand-sheet-footer"><span>MISE / KPH PARTICIPAÇÕES</span><p>Tudo pronto para fazer bem.</p><span>IDENTIDADE / 04.4</span></footer>
    </div>
    <section className="brand-files" id="brand-files"><div><p className="brand-kicker">KIT DA MARCA</p><h2>Pronto para aplicar.</h2><p>Arquivos vetoriais com letras convertidas em curvas, para manter a mesma aparência em qualquer tamanho.</p></div><div className="brand-downloads">{assets.map(asset => <a key={asset.file} href={`/brand/${asset.file}`} download><span>{asset.name}</span><span>SVG<Download size={14} /></span></a>)}</div><Link href="/preview" className="brand-back-to-app">Ver a identidade na plataforma<ArrowUpRight size={16} /></Link></section>
  </main>
}
