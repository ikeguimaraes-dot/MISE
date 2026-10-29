import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'

export default async function EventosPage() {
  if (!await getMiseSession()) redirect('/login')
  redirect('/eventos/dashboard')
}
