import { groups, rows, statuses, text, type Evento } from './model'
import type { EventContract } from './event-document'

const hasValue = (value: unknown) => text(value).trim() !== ''
const time = (value: unknown) => text(value).slice(0, 5)
const date = (value: unknown) => text(value).split('-').reverse().join('/')

/** A separate paper layout keeps form controls and financial data off the OS. */
export default function EventPrint({ event, documents = [] }: { event: Evento; documents?: EventContract[] }) {
  const metadata = [
    ['Data', date(event.data_inicio)],
    ['Horário', [time(event.hora_inicio), time(event.hora_termino)].filter(Boolean).join(' às ')],
    ['Convidados', event.num_convidados],
    ['Tipo', event.tipo_evento],
    ['Tema', event.tema],
    ['Contato', event.contato],
    ['Comercial', event.responsavel_comercial],
    ['Operação', event.responsavel_operacional],
  ].filter(([, value]) => hasValue(value))
  const brigade = rows(event.brigada).filter(item => item.servico !== '_info' && (hasValue(item.funcao) || hasValue(item.qtd)))
  const brigadeRows = Array.from({ length: Math.ceil(brigade.length / 3) }, (_, index) => brigade.slice(index * 3, index * 3 + 3))
  const layouts = rows(event.layout_anexos)
  return <article className="event-print" aria-label="O.S. para impressão">
    <div className="event-print-heading">
      <div className="event-print-kicker">ORDEM DE SERVIÇO{event.id ? ` · #${event.id}` : ''}<span>V{Number(event.versao ?? 1)} · {statuses[text(event.status)] || text(event.status)}</span></div>
      <h1>{text(event.nome_evento).toLocaleUpperCase('pt-BR')}</h1>
      <p>{text(event.casa)}{hasValue(event.espacos) ? ` · ${text(event.espacos).split('\n').filter(Boolean).join(' / ')}` : ''}</p>
    </div>
    {metadata.length > 0 && <dl className="event-print-summary">{metadata.map(([label, value]) => <div key={text(label)}><dt>{text(label)}</dt><dd>{text(value)}</dd></div>)}</dl>}
    {hasValue(event.briefing_cliente) && <section className="event-print-section"><h2>Briefing do cliente</h2><p className="event-print-prose">{text(event.briefing_cliente)}</p></section>}
    {groups.filter(group => ['Montagem e operação', 'Infraestrutura'].includes(group.title)).map(group => {
      const fields = group.fields.filter(([key]) => hasValue(event[key]))
      return fields.length ? <section className="event-print-section" key={group.title}><h2>{group.title}</h2><dl className="event-print-details">{fields.map(([key, label, kind]) => <div key={key} className={kind === 'textarea' ? 'event-print-wide' : undefined}><dt>{label}</dt><dd>{text(event[key])}</dd></div>)}</dl></section> : null
    })}
    {brigadeRows.length > 0 && <section className="event-print-section"><h2>Brigada</h2><table className="event-print-brigade"><colgroup>{[0, 1, 2].map(index => <col key={index} span={2} />)}</colgroup><thead><tr>{[0, 1, 2].map(index => <th key={index} colSpan={2}>Função <span>Qtd.</span></th>)}</tr></thead><tbody>{brigadeRows.map((items, index) => <tr key={index}>{[0, 1, 2].map(column => <td key={column} colSpan={2}><div><span>{text(items[column]?.funcao)}</span><strong>{text(items[column]?.qtd)}</strong></div></td>)}</tr>)}</tbody></table></section>}
    {(['menu_bar', 'menu_cozinha'] as const).map(key => {
      const items = rows(event[key])
      const entries = items.filter(item => item.servico !== '_info')
      const info = items.filter(item => item.servico === '_info' && hasValue(item.descritivo))
      if (!entries.length && !info.length) return null
      return <section className="event-print-section" key={key}><h2>{key === 'menu_bar' ? 'Menu bar' : 'Menu cozinha'}</h2>
        {entries.length > 0 && <table className="event-print-menu"><colgroup><col style={{ width: '25%' }} /><col style={{ width: '14%' }} /><col style={{ width: '61%' }} /></colgroup><thead><tr><th>Categoria / serviço</th><th>Horário</th><th>Descrição / observações</th></tr></thead><tbody>{entries.map((item, index) => <tr key={index}><td><strong>{text(item.categoria)}</strong>{hasValue(item.servico) && <div>{text(item.servico)}</div>}</td><td>{[time(item.hr_ini), time(item.hr_fim)].filter(Boolean).join(' – ')}</td><td>{hasValue(item.descritivo) && <div className="event-print-prose">{text(item.descritivo)}</div>}{hasValue(item.obs) && <p className="event-print-menu-note"><strong>Obs.:</strong> {text(item.obs)}</p>}</td></tr>)}</tbody></table>}
        {info.map((item, index) => <p className="event-print-menu-info" key={index}><strong>Informações gerais: </strong>{text(item.descritivo)}</p>)}
      </section>
    })}
    {(layouts.length > 0 || documents.length > 0) && <section className="event-print-section"><h2>Documentos e anexos</h2><ul className="event-print-attachments">{layouts.map((file, index) => <li key={`layout-${index}`}>{text(file.name) || 'Anexo de layout'}</li>)}{documents.map(file => <li key={file.key}>{file.name}</li>)}</ul></section>}
  </article>
}
