import { getMiseSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getMiseSession()
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!session) return Response.json({ message: 'Sua sessão do MISE expirou. Entre novamente no MISE.' }, { status: 401, headers })
  if (!process.env.EVENTOS_SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ message: 'O acesso a Eventos ainda não foi configurado neste ambiente.' }, { status: 503, headers })
  }
  return Response.json({
    id: session.employeeId,
    nome: session.employeeName,
    nivel_acesso: { admin: 'admin', gerente: 'comercial', cozinheiro: 'operacional' }[session.role],
  }, { headers })
}
