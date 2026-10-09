export type EtiquetaTsplData = {
  nome: string
  metodo?: string | null
  dataManipulacao: string | Date
  validade: string | Date
  respNome: string
  id: string
  quantidade?: number
}

function fmtDate(v: string | Date): string {
  return new Date(v).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

// Remove acentos, aspas e o símbolo de grau — a fonte bitmap interna da
// impressora TSPL não os renderiza (grau vira código, acentos somem/quebram).
const diacritics = new RegExp('[\\u0300-\\u036f]', 'g')
function ascii(s?: string | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(diacritics, '')
    .replace(/°C/gi, ' C')
    .replace(/°/g, '')
    .replace(/"/g, "'")
}

function wrapText(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []

  for (const word of words) {
    const chunks = word.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? []
    for (const chunk of chunks) {
      const current = lines.at(-1)
      if (current && `${current} ${chunk}`.length <= maxChars) {
        lines[lines.length - 1] = `${current} ${chunk}`
      } else {
        lines.push(chunk)
      }
    }
  }

  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines)
    visible[maxLines - 1] = visible[maxLines - 1].slice(0, maxChars - 3) + '...'
    return visible
  }
  return lines
}

// Mantém a fonte grande ("4" = 24x32) e quebra o nome na largura útil de 448 dots.
function productNameLines(value: string): string[] {
  const name = ascii(value).trim() || 'SEM NOME'
  return wrapText(name, 18, 5)
}

// Monta os comandos TSPL da etiqueta 60x60mm (480x480 dots @ 203dpi),
// com as coordenadas Y distribuídas de forma equilibrada pela altura da etiqueta:
// nome+método no topo, bloco de datas centralizado, resp./#ID na base.
export function buildTSPL(data: EtiquetaTsplData): string {
  const { nome, metodo, dataManipulacao, validade, respNome, id, quantidade = 1 } = data
  const left = 16
  const cmds: string[] = []
  cmds.push('SIZE 60 mm, 60 mm')
  cmds.push('GAP 2 mm, 0 mm')
  cmds.push('SET BUZZER OFF')
  cmds.push('DIRECTION 1')
  cmds.push('CLS')

  let y = 24
  // Nome sempre na fonte grande; quando necessário, continua na linha seguinte.
  for (const line of productNameLines(nome)) {
    cmds.push(`TEXT ${left},${y},"4",0,1,1,"${line}"`)
    y += 36
  }
  if (metodo) {
    y += 6
    cmds.push(`TEXT ${left},${y},"1",0,1,1,"${ascii(metodo.toUpperCase())}"`)
    y += 16
  }
  // O bloco inferior desce conforme o nome ganha linhas, sem sobrepor informações.
  y = Math.max(180, y + 14)
  cmds.push(`BAR ${left},${y},448,3`)
  y += 24
  cmds.push(`TEXT ${left},${y},"2",0,1,1,"MANIPULACAO: ${fmtDate(dataManipulacao)}"`)
  y += 30
  // Validade em destaque — fonte "4" (24x32) só na data, é a info mais crítica pra cozinha.
  // Rótulo fica na fonte "2" de sempre, centralizado verticalmente contra a data maior.
  cmds.push(`TEXT ${left},${y + 6},"2",0,1,1,"VALIDADE:"`)
  cmds.push(`TEXT ${left + 116},${y},"4",0,1,1,"${fmtDate(validade)}"`)
  y += 48
  cmds.push(`BAR ${left},${y},448,3`)
  y += 32
  cmds.push(`TEXT ${left},${y},"2",0,1,1,"RESP.: ${ascii(respNome)}"`)
  y += 28
  cmds.push(`TEXT ${left},${y},"1",0,1,1,"#${id.slice(0, 6).toUpperCase()}"`)
  cmds.push(`PRINT ${quantidade}`)

  return cmds.join('\r\n') + '\r\n'
}

// Bytes UTF-8 → base64 (método seguro, evita corromper bytes >127 que btoa direto quebraria).
export function tsplToBase64(tspl: string): string {
  const bytes = new TextEncoder().encode(tspl)
  let bin = ''
  bytes.forEach(b => (bin += String.fromCharCode(b)))
  return btoa(bin)
}
