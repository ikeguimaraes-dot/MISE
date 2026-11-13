'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRAZIL_STATES, BUSINESS_TEXT_FIELDS, formatCnpj, validateBusinessRegistration, type BusinessKind, type BusinessRegistration, type BusinessTextField, type CompanyOption } from '@/lib/business-registration'

const inputClass = 'w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none'
const sections: { title: string; fields: { name: BusinessTextField; label: string; required?: boolean; type?: string; placeholder?: string }[] }[] = [
  { title: 'Identificação', fields: [
    { name: 'name', label: 'Nome fantasia', required: true },
    { name: 'legal_name', label: 'Razão social', required: true },
    { name: 'cnpj', label: 'CNPJ', required: true, placeholder: '00.000.000/0001-00' },
    { name: 'state_registration', label: 'Inscrição estadual', placeholder: 'Número ou ISENTO' },
    { name: 'municipal_registration', label: 'Inscrição municipal' },
    { name: 'cnae', label: 'CNAE principal', placeholder: '0000-0/00' },
  ] },
  { title: 'Endereço', fields: [
    { name: 'postal_code', label: 'CEP', required: true, placeholder: '00000-000' },
    { name: 'street', label: 'Logradouro', required: true },
    { name: 'street_number', label: 'Número', required: true, placeholder: 'Número ou S/N' },
    { name: 'complement', label: 'Complemento' },
    { name: 'district', label: 'Bairro', required: true },
    { name: 'city', label: 'Cidade', required: true },
    { name: 'state', label: 'UF', required: true },
  ] },
  { title: 'Contato', fields: [
    { name: 'phone', label: 'Telefone / WhatsApp', type: 'tel', placeholder: '(11) 99999-9999' },
    { name: 'email', label: 'E-mail', type: 'email' },
    { name: 'website', label: 'Site', placeholder: 'https://empresa.com.br' },
    { name: 'contact_name', label: 'Responsável pelo contato' },
  ] },
]

export function BusinessForm({ kind, initial, companies = [], selectedCompanyId = '' }: { kind: BusinessKind; initial?: BusinessRegistration; companies?: CompanyOption[]; selectedCompanyId?: string }) {
  const router = useRouter()
  const basePath = kind === 'empresa' ? '/cadastros/empresas' : '/cadastros/unidades'
  const [values, setValues] = useState(() => Object.fromEntries(BUSINESS_TEXT_FIELDS.map(field => [field, field === 'cnpj' && initial?.cnpj ? formatCnpj(initial.cnpj) : initial?.[field] ?? ''])) as Record<BusinessTextField, string>)
  const [companyId, setCompanyId] = useState(initial?.company_id ?? selectedCompanyId)
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    let payload: ReturnType<typeof validateBusinessRegistration>
    try { payload = validateBusinessRegistration({ ...values, company_id: companyId, active }, kind) }
    catch (error) { setError(error instanceof Error ? error.message : 'Confira os campos do cadastro.'); return }
    setSaving(true)
    try {
      const result = await fetch(`/api/${kind === 'empresa' ? 'empresas' : 'unidades'}${initial ? `/${initial.id}` : ''}`, { method: initial ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const response = await result.json()
      if (!result.ok || !response.id) throw new Error(response.error || 'Não foi possível confirmar a gravação do cadastro.')
      router.push(basePath)
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar o cadastro.') }
    finally { setSaving(false) }
  }

  return <form onSubmit={submit} className="max-w-4xl space-y-6">
    {kind === 'unidade' && <section className="rounded-xl border border-edge bg-surface p-5 space-y-3">
      <label htmlFor="business-company" className="block text-sm font-semibold text-ink">Empresa da unidade *</label>
      <select id="business-company" value={companyId} onChange={event => setCompanyId(event.target.value)} required className={inputClass}>
        <option value="">Selecionar empresa</option>
        {companies.map(company => <option key={company.id} value={company.id}>{company.name}{company.active ? '' : ' (inativa)'}</option>)}
      </select>
      {!companies.length && <p className="text-sm text-ink-muted">Cadastre uma empresa antes de criar a unidade. <Link href="/cadastros/empresas/novo" className="text-ember underline">Cadastrar empresa</Link></p>}
    </section>}
    {initial?.address && !initial.street && <p className="rounded-lg border border-edge p-4 text-sm text-ink-muted">Endereço atual: {initial.address}. Complete os campos abaixo para atualizar o cadastro.</p>}
    {sections.map(section => <section key={section.title} className="rounded-xl border border-edge bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink">{section.title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{section.fields.map(field => <div key={field.name}>
        <label htmlFor={`business-${field.name}`} className="mb-1 block text-xs font-medium text-ink-muted">{kind === 'unidade' && field.name === 'name' ? 'Nome da unidade / nome fantasia' : field.label}{field.required ? ' *' : ''}</label>
        {field.name === 'state' ? <select id={`business-${field.name}`} value={values.state} onChange={event => setValues(values => ({ ...values, state: event.target.value }))} required className={inputClass}>
          <option value="">Selecionar UF</option>{BRAZIL_STATES.map(state => <option key={state} value={state}>{state}</option>)}
        </select> : <input id={`business-${field.name}`} name={field.name} value={values[field.name]} onChange={event => setValues(values => ({ ...values, [field.name]: field.name === 'cnpj' ? event.target.value.toUpperCase() : event.target.value }))} required={field.required} type={field.type ?? 'text'} maxLength={250} placeholder={field.placeholder} autoCapitalize={field.name === 'cnpj' ? 'characters' : undefined} className={inputClass} />}
      </div>)}</div>
    </section>)}
    <section className="rounded-xl border border-edge bg-surface p-5 space-y-4">
      <div><label htmlFor="business-notes" className="mb-1 block text-xs font-medium text-ink-muted">Observações</label><textarea id="business-notes" value={values.notes} onChange={event => setValues(values => ({ ...values, notes: event.target.value }))} rows={3} maxLength={4000} className={inputClass} /></div>
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />{kind === 'empresa' ? 'Empresa ativa' : 'Unidade ativa na operação'}</label>
    </section>
    {error && <p role="alert" className="text-sm text-alert-bright">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={saving || (kind === 'unidade' && !companies.length)} className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50">{saving ? 'Salvando…' : initial ? 'Salvar alterações' : kind === 'empresa' ? 'Cadastrar empresa' : 'Cadastrar unidade'}</button>
      <Link href={basePath} className="rounded-lg border border-edge-strong px-4 py-2.5 text-sm text-ink-muted hover:text-ink">Cancelar</Link>
    </div>
  </form>
}
