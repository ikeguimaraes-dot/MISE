'use client'
import {moedaAoDigitar,moedaParaExibicao} from '@/lib/utils'
export function ExtraCurrencyInput({value,onChange,label,required=true,disabled=false}:{value:string;onChange:(value:string)=>void;label:string;required?:boolean;disabled?:boolean}){
 return <span className="er-currency-input"><span aria-hidden="true">R$</span><input aria-label={label} inputMode="numeric" value={moedaParaExibicao(value)} onChange={e=>onChange(moedaAoDigitar(e.target.value).estado)} required={required} disabled={disabled} maxLength={18}/></span>
}
