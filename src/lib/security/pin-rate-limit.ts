import 'server-only'
import type { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceClient>
type AttemptState = { count: number; resetAt: number }

const fallbackAttempts = new Map<string, AttemptState>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function makePinRateKey(request: Request, employeeId: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip') || 'unknown'
  return digest(`${ip}:${employeeId}`)
}

export async function checkPinRateLimit(client: ServiceClient, keyHash: string) {
  const now = Date.now()
  const { data, error } = await client
    .schema('mise')
    .from('pin_login_attempts')
    .select('blocked_until')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!error) {
    const blockedUntil = data?.blocked_until ? new Date(data.blocked_until).getTime() : 0
    return blockedUntil > now ? Math.ceil((blockedUntil - now) / 1000) : 0
  }

  const fallback = fallbackAttempts.get(keyHash)
  if (!fallback || fallback.resetAt <= now) {
    fallbackAttempts.delete(keyHash)
    return 0
  }
  return fallback.count >= MAX_ATTEMPTS
    ? Math.ceil((fallback.resetAt - now) / 1000)
    : 0
}

export async function recordPinFailure(client: ServiceClient, keyHash: string) {
  const schemaClient = client.schema('mise') as unknown as {
    rpc(name: string, params: Record<string, string>): PromiseLike<{ error: unknown }>
  }
  const { error } = await schemaClient.rpc('record_pin_login_failure', { p_key_hash: keyHash })
  if (!error) return

  const now = Date.now()
  const current = fallbackAttempts.get(keyHash)
  fallbackAttempts.set(keyHash, {
    count: current && current.resetAt > now ? current.count + 1 : 1,
    resetAt: current && current.resetAt > now ? current.resetAt : now + WINDOW_MS,
  })
}

export async function clearPinFailures(client: ServiceClient, keyHash: string) {
  fallbackAttempts.delete(keyHash)
  await client
    .schema('mise')
    .from('pin_login_attempts')
    .delete()
    .eq('key_hash', keyHash)
}
