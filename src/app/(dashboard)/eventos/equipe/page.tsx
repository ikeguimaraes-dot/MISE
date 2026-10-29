import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import FuncionariosPage from '../../cadastros/funcionarios/page'

export default async function EquipeEventosPage() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role === 'cozinheiro') redirect('/eventos/lista')
  return <FuncionariosPage />
}
