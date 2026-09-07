'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm({ preview = false }: { preview?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (loading) return
    setError('')
    if (preview) {
      setError('Esta é uma prévia visual. O acesso à conta está desativado aqui.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError('Email ou senha inválidos. Confira os dados e tente novamente.'); return }
      // Preserve the existing cleanup of a previous PIN session.
      await fetch('/api/auth/pin-logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    } catch {
      setError('Não foi possível conectar. Tente novamente em instantes.')
    } finally { setLoading(false) }
  }

  return <>
    <span className="auth-access-icon"><LockKeyhole size={22} strokeWidth={1.5} /></span>
    <p className="section-eyebrow mb-3">ACESSO DE GESTORES</p>
    <h1 className="auth-title">Bom ter você aqui<span>.</span></h1>
    <p className="auth-description">Entre para acompanhar e cuidar da sua operação.</p>
    <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
      <div><label htmlFor="login-email" className="auth-label">Email de acesso</label><input id="login-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required placeholder="voce@empresa.com.br" className="auth-input" /></div>
      <div><label htmlFor="login-password" className="auth-label">Senha</label><div className="relative"><input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required placeholder="Sua senha" className="auth-input auth-password-input" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} className="auth-password-toggle">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <button type="submit" disabled={loading} className="workspace-primary-button auth-submit">{loading ? 'Entrando…' : 'Entrar na operação'}<ArrowRight size={17} /></button>
    </form>
    <div className="auth-alternative"><p>Faz parte da equipe operacional?</p><Link href={preview ? '/preview?module=pin-login' : '/pin-login'}><KeyRound size={15} />Entrar com meu PIN<ArrowRight size={14} /></Link></div>
  </>
}
