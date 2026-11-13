import { getMiseSession } from '@/lib/session'
import { EtiquetasCadastros } from '../_components/etiquetas-navigation'

export default async function CadastrosPage() {
  const session = await getMiseSession()
  return <EtiquetasCadastros canManageCompanies={session?.role === 'admin'} />
}
