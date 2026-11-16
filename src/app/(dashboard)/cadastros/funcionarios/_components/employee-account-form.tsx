'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Option = { id: string; label: string }
const fieldClass = 'mt-1 w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none'

export function EmployeeAccountForm({ units, roles }: { units: Option[]; roles: Option[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(fields)),
      })
      const data = await response.json()
      if (!response.ok || !data.id) throw new Error(data.error || 'Não foi possível confirmar o cadastro.')
      form.reset()
      setSuccess('Usuário criado. Já pode entrar com o e-mail e a senha cadastrados.')
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível cadastrar o usuário.')
    } finally {
      setSaving(false)
    }
  }

  return <details className="rounded-xl border border-edge bg-surface p-5">
    <summary className="cursor-pointer text-sm font-semibold text-ink">Cadastrar novo usuário</summary>
    <p className="mt-3 text-xs text-ink-muted">Crie o login e o funcionário juntos. O cargo define as permissões do usuário. Administrador master tem acesso total ao MISE.</p>
    <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
      <fieldset disabled={saving} className="contents">
        <label className="text-xs font-medium text-ink-muted">Nome *<input name="nome" required maxLength={100} autoComplete="given-name" className={fieldClass} /></label>
        <label className="text-xs font-medium text-ink-muted">Sobrenome<input name="sobrenome" maxLength={150} autoComplete="family-name" className={fieldClass} /></label>
        <label className="text-xs font-medium text-ink-muted">E-mail de acesso *<input name="email" type="email" required maxLength={254} autoComplete="off" className={fieldClass} /></label>
        <label className="text-xs font-medium text-ink-muted">Senha inicial *<input name="password" type="password" required minLength={6} maxLength={256} autoComplete="new-password" className={fieldClass} /><span className="mt-1 block font-normal">Mínimo de 6 caracteres, conforme a política do banco.</span></label>
        <label className="text-xs font-medium text-ink-muted">Unidade *<select name="unit_id" required defaultValue="" className={fieldClass}><option value="" disabled>Selecionar unidade</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
        <label className="text-xs font-medium text-ink-muted">Cargo / perfil de acesso *<select name="role_id" required defaultValue="" className={fieldClass}><option value="" disabled>Selecionar cargo</option>{roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving || !roles.length || !units.length} className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink disabled:opacity-50">{saving ? 'Cadastrando…' : 'Criar usuário'}</button>
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-alert-bright sm:col-span-2">{error}</p>}
      {success && <p role="status" className="text-sm text-fresh-bright sm:col-span-2">{success}</p>}
    </form>
  </details>
}
