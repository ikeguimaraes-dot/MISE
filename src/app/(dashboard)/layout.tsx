import { TopNav } from '@/components/layout/topnav'
import { createClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const session = await getMiseSession()
  const role = session?.role ?? 'cozinheiro'
  const isPinUser = !user && !!session

  return (
    <div className="min-h-screen bg-base">
      <TopNav role={role} isPinUser={isPinUser} employeeName={session?.employeeName} />
      <main id="main-content" tabIndex={-1} className="workspace-main">
        {children}
      </main>
    </div>
  )
}
