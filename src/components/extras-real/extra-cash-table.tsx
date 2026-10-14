import Link from 'next/link'
import {STATUS_LABELS} from '@/lib/extras/workflow'
type CashRow={id:string;nome:string|null;solicitante_nome:string|null;setor:string;funcao:string;periodo:string|null;valor:number|null;total:number|null;status:string;pagadora:string|null;emergencial:boolean}
const money=(n:number|null)=>n==null?'A definir':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export function ExtraCashTable({rows,unit,day}:{rows:CashRow[];unit:string;day:string}){
 return <div className="overflow-x-auto"><table className="opx-cash-table"><caption className="sr-only">Pessoas preparadas pelo RH e situação de cada pagamento</caption><thead><tr>{['Pessoa / função','Solicitante','Setor / turno','Pagadora','Diária','Total','Etapa'].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(e=><tr key={e.id}>
  <td data-label="Pessoa / função"><span><Link href={`/extras?unit_id=${unit}&extra_id=${e.id}&data=${day}`}>{e.nome??'A definir'}</Link><br/>{e.funcao}{e.emergencial?' · Emergencial':''}</span></td>
  <td data-label="Solicitante"><span>{e.solicitante_nome||'Não informado'}</span></td>
  <td data-label="Setor / turno"><span>{e.setor}<br/>{e.periodo}</span></td>
  <td data-label="Pagadora"><span>{e.pagadora==='casa'?'Casa':'Estaff'}</span></td>
  <td data-label="Diária"><span>{money(e.valor)}</span></td>
  <td data-label="Total"><span>{money(e.total)}</span></td>
  <td data-label="Etapa"><span>{STATUS_LABELS[e.status]??e.status}</span></td>
 </tr>)}</tbody></table></div>
}
