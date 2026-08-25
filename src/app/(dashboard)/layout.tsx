import { TopNav } from '@/components/layout/topnav'
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
    <div className="min-h-screen bg-base">
      <TopNav role={role} isPinUser={isPinUser} />
      <main className="w-full">
        {children}
      </main>
    </div>
  )
}
