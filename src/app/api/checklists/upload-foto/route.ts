import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getMiseSession } from '@/lib/session'
import { authorizeChecklistPhoto } from '@/lib/checklists/photo-access'
import { checklistPhotoUrl } from '@/lib/checklists/photo-path'

export async function POST(request: Request) {
  if (!await getMiseSession()) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const formData = await request.formData()
  const file = formData.get('file')
  const executionId = String(formData.get('execution_id') ?? '')
  const itemId = String(formData.get('item_id') ?? '')
  const access = await authorizeChecklistPhoto(executionId, itemId)
  if (!access.ok) return NextResponse.json({ error: 'Acesso à execução negado.' }, { status: access.status })
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Foto inválida ou acima de 10 MB.' }, { status: 400 })
  const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const extension = types[file.type]
  if (!extension) return NextResponse.json({ error: 'Use JPEG, PNG ou WebP.' }, { status: 400 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const magic = extension === 'jpg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : extension === 'png' ? [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)
    : String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP'
  if (!magic) return NextResponse.json({ error: 'Conteúdo de imagem inválido.' }, { status: 400 })
  const path = `${executionId}/${itemId}/${randomUUID()}.${extension}`
  const { error } = await access.service.storage.from('checklist-photos').upload(path, bytes, { contentType: file.type, upsert: false })
  if (error) return NextResponse.json({ error: 'Não foi possível salvar a foto.' }, { status: 400 })
  return NextResponse.json({ url: checklistPhotoUrl(path) }, { headers: { 'Cache-Control': 'no-store' } })
}
