import { Sidebar } from '@/components/layout/sidebar'
import { createClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let role: 'admin' | 'gerente' | 'cozinheiro' = 'admin'
  let isPinUser = false

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const session = await getMiseSession()
    if (session) {
      role = session.role
      isPinUser = true
    }
  }

  return (
    <div className="flex h-screen bg-base">
      <Sidebar role={role} isPinUser={isPinUser} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
