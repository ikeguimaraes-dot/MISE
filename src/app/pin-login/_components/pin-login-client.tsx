'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Delete, KeyRound, Search, Users } from 'lucide-react'
import { AuthShell } from '@/components/layout/auth-shell'

type Employee = { id: string; nome: string }

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] ?? '').slice(0, 2).toUpperCase()
}

export function PinLoginClient({ employees, preview = false }: { employees: Employee[]; preview?: boolean }) {
  const [selected, setSelected] = useState<Employee | null>(null)
  const [query, setQuery] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)
  const router = useRouter()
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filtered = employees.filter(employee => normalize(employee.nome).includes(normalize(query)))

  async function submitPin(value: string) {
    if (!selected || !/^\d{4}$/.test(value) || inFlight.current) return
    if (preview) {
      setError('Prévia visual: o acesso por PIN não é enviado para autenticação.')
      setPin('')
      return
    }
    inFlight.current = true
    setLoading(true)
    try {
      const response = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: selected.id, pin: value }),
      })
      if (response.ok) { router.push('/'); router.refresh() }
      else {
        const data = await response.json()
        setError(data.error || 'PIN incorreto. Tente novamente.')
        setPin('')
      }
    } catch {
      setError('Não foi possível conectar. Tente novamente em instantes.')
      setPin('')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  function updatePin(value: string) {
    if (inFlight.current) return
    const next = value.replace(/\D/g, '').slice(0, 4)
    setPin(next)
    setError('')
    if (next.length === 4) void submitPin(next)
  }

  function changeEmployee(employee: Employee | null) {
    if (inFlight.current) return
    setSelected(employee)
    setPin('')
    setError('')
  }

  return <AuthShell preview={preview}>
    {!selected ? <>
      <span className="auth-access-icon"><Users size={23} strokeWidth={1.5} /></span>
      <p className="section-eyebrow mb-3">ACESSO DA EQUIPE</p>
      <h1 className="auth-title">Quem está entrando<span>?</span></h1>
      <p className="auth-description">Selecione seu nome para começar a operação.</p>
      <label className="auth-employee-search"><Search size={17} /><span className="sr-only">Buscar pessoa da equipe</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar seu nome" autoComplete="off" /></label>
      <div className="auth-employee-grid">
        {filtered.map(employee => <button type="button" key={employee.id} onClick={() => changeEmployee(employee)} className="auth-employee-card"><span className="auth-avatar">{initials(employee.nome)}</span><span>{employee.nome}</span><ArrowRight size={13} aria-hidden="true" /></button>)}
      </div>
      {!filtered.length && <p role="status" className="auth-empty">{employees.length ? 'Nenhum nome encontrado. Tente outra busca.' : 'Ainda não há pessoas com PIN de acesso disponível. Procure o gestor da unidade.'}</p>}
      <div className="auth-alternative"><p>Acessa a operação como gestor?</p><Link href={preview ? '/preview?module=login' : '/login'}>Entrar com email e senha<ArrowRight size={14} /></Link></div>
    </> : <>
      <button type="button" disabled={loading} onClick={() => changeEmployee(null)} className="auth-back"><ArrowLeft size={15} />Trocar pessoa</button>
      <div className="text-center"><span className="auth-avatar auth-selected-avatar">{initials(selected.nome)}</span><p className="section-eyebrow mb-3">ACESSO POR PIN</p><h1 className="auth-title text-[28px]">{selected.nome}</h1><p className="auth-description">Digite seu PIN de 4 dígitos.</p></div>
      <form className="auth-pin-form" onSubmit={event => { event.preventDefault(); void submitPin(pin) }} aria-busy={loading}>
        <label htmlFor="access-pin" className="sr-only">PIN de 4 dígitos</label>
        <input id="access-pin" className="auth-pin-input" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event => updatePin(event.target.value)} autoComplete="off" disabled={loading} placeholder="····" aria-describedby="pin-status" />
        <div className="auth-pin-keypad">
          {['1','2','3','4','5','6','7','8','9'].map(digit => <button type="button" key={digit} disabled={loading} onClick={() => updatePin(pin + digit)}>{digit}</button>)}
          <span className="flex items-center justify-center text-ink-faint"><KeyRound size={18} strokeWidth={1.5} aria-hidden="true" /></span>
          <button type="button" disabled={loading} onClick={() => updatePin(pin + '0')}>0</button>
          <button type="button" disabled={loading || pin.length === 0} onClick={() => updatePin(pin.slice(0, -1))} aria-label="Apagar último dígito"><Delete size={22} /></button>
        </div>
        <p id="pin-status" role="status" className="mt-5 text-center text-xs text-ink-subtle">{loading ? 'Conferindo seu acesso…' : 'O acesso é verificado ao digitar o quarto dígito.'}</p>
        {error && <p role="alert" className="auth-error mt-4">{error}</p>}
      </form>
    </>}
  </AuthShell>
}
