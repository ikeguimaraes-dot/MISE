import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    // Keep the local layout review accessible when credentials are placeholders.
    // This only redirects the entry page; it never grants a session or API access.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    if (request.nextUrl.pathname === '/' && !/^https?:\/\//.test(url)) {
      return NextResponse.redirect(new URL('/preview', request.url))
    }
    return NextResponse.next()
  }

  if (
    request.nextUrl.pathname.startsWith('/pin-login') ||
    request.nextUrl.pathname === '/api/auth/pin-login' ||
    request.nextUrl.pathname === '/api/auth/pin-logout'
  ) {
    return NextResponse.next()
  }

  // Machine-to-machine routes authenticate with their own Bearer token.
  if (request.nextUrl.pathname.startsWith('/api/integrations/kph/')) {
    return NextResponse.next()
  }

  // These endpoints validate real sessions and return JSON 401 themselves.
  if (request.nextUrl.pathname === '/api/checklists/foto' || request.nextUrl.pathname === '/api/checklists/upload-foto') return NextResponse.next()

  const miseSession = request.cookies.get('mise-session')
  if (miseSession?.value) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && serviceKey) {
      const supabase = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: session } = await supabase
        .schema('mise')
        .from('sessions')
        .select('id')
        .eq('id', miseSession.value)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (session) return NextResponse.next()
    }

    const response = await updateSession(request)
    response.cookies.set('mise-session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    return response
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
