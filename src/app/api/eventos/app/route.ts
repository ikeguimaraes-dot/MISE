import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getMiseSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!await getMiseSession()) return new Response('Sessão expirada. Entre novamente no MISE.', { status: 401 })
  const html = await readFile(path.join(process.cwd(), 'eventos/index.html'), 'utf8')
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "frame-ancestors 'self'",
  } })
}
