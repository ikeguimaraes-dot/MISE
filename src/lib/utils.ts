import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---- Máscara de moeda (parte inteira + centavos opcionais) ----
// Guardamos no estado o valor numérico como string com ponto decimal
// (ex: "1234.00"); exibimos com milhar e vírgula (ex: "1.234,00").
// Modelo: o usuário digita a parte inteira normalmente; a vírgula
// (opcional) separa os centavos. Ex: "1234" -> 1.234,00; "1234,5" -> 1.234,50.

/** Converte a string do estado (número puro) para exibição BR: "1234.5" -> "1.234,50" */
export function moedaParaExibicao(valorEstado: string): string {
  if (valorEstado === '' || valorEstado == null) return ''
  const n = parseFloat(valorEstado)
  if (isNaN(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Formata o texto que o usuário está digitando, preservando o que ele digita:
 *  parte inteira com separador de milhar, e centavos só se ele digitar a vírgula.
 *  Retorna { estado, exibicao }: estado = número puro pro form/banco ("1234.5"),
 *  exibicao = texto formatado pro input ("1.234,5"). */
export function moedaAoDigitar(input: string): { estado: string; exibicao: string } {
  // mantém só dígitos e a primeira vírgula/ponto como separador decimal
  let s = input.replace(/[^\d,.]/g, '').replace(/\./g, ',')
  const primeiraVirgula = s.indexOf(',')
  if (primeiraVirgula !== -1) {
    // remove vírgulas extras depois da primeira
    s = s.slice(0, primeiraVirgula + 1) + s.slice(primeiraVirgula + 1).replace(/,/g, '')
  }
  if (s === '' || s === ',') return { estado: '', exibicao: '' }

  const [inteiraRaw, centavosRaw] = s.split(',')
  const inteira = inteiraRaw.replace(/^0+(?=\d)/, '') || '0'
  const inteiraFmt = parseInt(inteira, 10).toLocaleString('pt-BR')

  if (centavosRaw === undefined) {
    // ainda sem vírgula — exibe só a parte inteira formatada
    return { estado: inteira, exibicao: inteiraFmt }
  }
  // com vírgula — limita centavos a 2 dígitos
  const centavos = centavosRaw.slice(0, 2)
  const estado = `${inteira}.${centavos === '' ? '0' : centavos}`
  return { estado, exibicao: `${inteiraFmt},${centavos}` }
}
