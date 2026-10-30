import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { getMiseSession } from '@/lib/session'

export const dynamic = 'force-dynamic'
const bucket = 'mise-eventos-documentos'
const maxSize = 3 * 1024 * 1024
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (message: string, status: number) => Response.json({ message }, { status, headers })

async function handle(request: Request) {
  const session = await getMiseSession()
  if (!session) return fail('Sua sessão expirou. Entre novamente no MISE.', 401)
  if (!['admin', 'gerente', 'cozinheiro'].includes(session.role)) return fail('Acesso não permitido.', 403)
  if (request.method === 'POST' && session.role === 'cozinheiro') return fail('Seu acesso permite apenas consultar contratos.', 403)
  const url = new URL(request.url)
  const id = url.searchParams.get('id') || ''
  if (!/^[1-9]\d*$/.test(id)) return fail('Informe a O.S. do contrato.', 400)
  if (request.method === 'POST') {
    const origin = request.headers.get('origin')
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return fail('Origem não permitida.', 403)
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) return fail('Envie o contrato como arquivo.', 415)
    if (Number(request.headers.get('content-length')) > maxSize + 65536) return fail('O contrato deve ter até 3 MB.', 413)
  }
  const fileKey = url.searchParams.get('file')
  if (fileKey && !/^[0-9a-f-]{36}--[A-Za-z0-9._-]+$/.test(fileKey)) return fail('Documento inválido.', 400)
  const key = process.env.EVENTOS_SUPABASE_SERVICE_ROLE_KEY
  if (!key) return fail('O acesso a Documentos ainda não foi configurado.', 503)
  try {
    const client = createClient('https://rpavxnjchfmeiacnumpk.supabase.co', key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: event, error: eventError } = await client.from('eventos').select('id').eq('id', Number(id)).maybeSingle()
    if (eventError) return fail('Não foi possível consultar a O.S.', 502)
    if (!event) return fail('O.S. não encontrada.', 404)
    const storage = client.storage.from(bucket)
    if (request.method === 'GET' && fileKey) {
      const { data, error } = await storage.createSignedUrl(`${id}/${fileKey}`, 60)
      if (error || !data) return fail('Contrato não encontrado ou indisponível.', 404)
      return new Response(null, { status: 302, headers: { ...headers, Location: data.signedUrl } })
    }
    if (request.method === 'POST') {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File) || !file.size) return fail('Selecione um contrato para enviar.', 400)
      if (file.size > maxSize) return fail('O contrato deve ter até 3 MB.', 413)
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return fail('Envie o contrato em PDF, JPG ou PNG.', 400)
      const bytes = new Uint8Array(await file.arrayBuffer())
      const valid = file.type === 'application/pdf' ? String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-' : file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      if (!valid) return fail('O conteúdo do arquivo não corresponde a PDF, JPG ou PNG.', 400)
      const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[file.type]
      const name = file.name.replace(/\.[^.]*$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 100) || 'contrato'
      const path = `${id}/${randomUUID()}--${name}.${extension}`
      const { error } = await storage.upload(path, bytes, { contentType: file.type, upsert: false })
      if (error) return fail('Não foi possível enviar o contrato. Tente novamente.', 502)
      return Response.json({ key: path.slice(id.length + 1), name: `${name}.${extension}`, size: file.size }, { status: 201, headers })
    }
    const files = []
    // Storage lists at most one page at a time; include all contracts in the OS.
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await storage.list(id, { limit: 100, offset, sortBy: { column: 'created_at', order: 'desc' } })
      if (error) return fail('Não foi possível carregar os contratos.', 502)
      files.push(...(data || []).filter(file => file.id).map(file => ({ key: file.name, name: file.name.slice(38), size: file.metadata?.size, createdAt: file.created_at })))
      if (!data || data.length < 100) break
    }
    return Response.json(files, { headers })
  } catch {
    return fail('Não foi possível concluir a operação com o contrato.', 502)
  }
}

export { handle as GET, handle as POST }
