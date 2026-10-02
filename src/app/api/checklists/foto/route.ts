import { NextResponse } from 'next/server'
import { checklistPhotoPath } from '@/lib/checklists/photo-path'
import { authorizeChecklistPhoto } from '@/lib/checklists/photo-access'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const path = checklistPhotoPath(new URL(request.url).searchParams.get('path'))
  const [executionId = '', itemId = ''] = (path ?? '').split('/')
  const access = await authorizeChecklistPhoto(executionId, itemId)
  if (!access.ok) return NextResponse.json({ error: 'Acesso à foto negado.' }, { status: access.status, headers: { 'Cache-Control': 'no-store' } })
  if (!path) return NextResponse.json({ error: 'Foto inválida.' }, { status: 400 })
  const { data, error } = await access.service.storage.from('checklist-photos').createSignedUrl(path, 60)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Foto indisponível.' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl, { status: 307, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
}
