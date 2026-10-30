import type { Evento } from './model'

// Only reads can be retried safely after a lost connection. A write might have
// reached the server even when the browser did not receive its response.
export async function eventApi(query = '', method = 'GET', body?: Evento): Promise<Evento[]> {
  for (let attempt = 0; attempt < (method === 'GET' ? 2 : 1); attempt++) {
    let response: Response
    let data: Evento[] & { message?: string }
    try {
      response = await fetch(`/api/eventos/data${query}`, {
        method, cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      // Reading the body can also fail if the connection drops mid-response.
      data = await response.json()
    } catch (error) {
      if (!(error instanceof TypeError)) throw new Error('O servidor retornou uma resposta inesperada. Atualize a página e tente novamente.')
      if (method !== 'GET' || attempt === 1) {
        throw new Error(method === 'GET'
          ? 'A conexão foi interrompida ao carregar os eventos. Tente novamente.'
          : 'A conexão foi interrompida. Reabra a O.S. para conferir se a alteração foi salva antes de tentar novamente.')
      }
      continue
    }
    if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.')
    return data
  }
  throw new Error('Não foi possível carregar os eventos.')
}
