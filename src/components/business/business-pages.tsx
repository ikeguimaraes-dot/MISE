import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { requireMiseRole } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/server'
import { BUSINESS_COLUMNS, formatCnpj, isUuid, type BusinessKind, type BusinessRegistration, type CompanyOption } from '@/lib/business-registration'
import { BusinessForm } from './business-form'

type Filters = { q?: string; company?: string; page?: string }

async function requireAdmin() {
  if (!await requireMiseRole(['admin'])) redirect('/')
}

export async function BusinessIndex({ kind, filters }: { kind: BusinessKind; filters: Filters }) {
  await requireAdmin()
  const isCompany = kind === 'empresa'
  const path = isCompany ? '/cadastros/empresas' : '/cadastros/unidades'
  const title = isCompany ? 'Empresas' : 'Unidades da empresa'
  const requestedPage = Number(filters.page)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const q = typeof filters.q === 'string' ? filters.q.trim().slice(0, 100) : ''
  const companyId = !isCompany && isUuid(filters.company) ? filters.company : ''
  const db = createServiceClient()
  const companiesRequest = db.schema('mise').from('companies').select('id,name,active').order('name')
  let query = isCompany
    ? db.schema('mise').from('companies').select('id,name,legal_name,cnpj,city,state,active', { count: 'exact' })
    : db.from('units').select('id,name,legal_name,cnpj,city,state,active,company_id', { count: 'exact' })
  query = query.order('name').range((page - 1) * 20, page * 20 - 1)
  if (q) query = query.ilike('name', `%${q}%`)
  if (companyId) query = query.eq('company_id', companyId)
  const [result, companyResult] = await Promise.all([query, companiesRequest])
  if (result.error || companyResult.error) throw new Error('Não foi possível carregar os cadastros. Tente novamente.')
  const rows = (result.data ?? []) as unknown as BusinessRegistration[]
  const companies = (companyResult.data ?? []) as CompanyOption[]
  const companyNames = new Map(companies.map(company => [company.id, company.name]))
  const totalPages = Math.ceil((result.count ?? 0) / 20)
  const pageHref = (value: number) => `${path}?${new URLSearchParams({ ...(q ? { q } : {}), ...(companyId ? { company: companyId } : {}), page: String(value) })}`

  return <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
    <Link href="/etiquetas/cadastros" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ember"><ArrowLeft size={15} />Voltar para Cadastro</Link>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-ink">{title}</h1><p className="mt-2 text-sm text-ink-muted">{isCompany ? 'Dados fiscais, endereço e contatos das empresas.' : 'Cadastre as unidades e vincule cada uma à sua empresa.'}</p></div>
      <Link href={`${path}/novo${companyId ? `?company=${companyId}` : ''}`} className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover"><Plus size={16} />{isCompany ? 'Nova empresa' : 'Nova unidade'}</Link>
    </div>
    <form className="flex flex-wrap items-end gap-3">
      <div><label htmlFor="business-search" className="mb-1 block text-xs text-ink-muted">Buscar pelo nome</label><input id="business-search" name="q" defaultValue={q} className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink" /></div>
      {!isCompany && <div><label htmlFor="business-filter-company" className="mb-1 block text-xs text-ink-muted">Empresa</label><select id="business-filter-company" name="company" defaultValue={companyId} className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink"><option value="">Todas as empresas</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>}
      <button className="rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink">Filtrar</button>
      {(q || companyId) && <Link href={path} className="px-3 py-2 text-sm text-ink-muted hover:text-ember">Limpar filtros</Link>}
    </form>
    <div className="overflow-x-auto rounded-xl border border-edge bg-surface">
      <table className="w-full text-left text-sm"><thead><tr className="border-b border-edge">{[isCompany ? 'Empresa' : 'Unidade', 'CNPJ', ...(!isCompany ? ['Empresa'] : []), 'Cidade / UF', 'Status', 'Ações'].map(label => <th key={label} className="px-5 py-3 text-xs font-medium text-ink-muted">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-edge">{rows.map(row => <tr key={row.id} className="hover:bg-surface-raised/50">
          <td className="px-5 py-4"><p className="font-medium text-ink">{row.name}</p><p className="mt-1 text-xs text-ink-muted">{row.legal_name || 'Complete os dados cadastrais'}</p></td>
          <td className="whitespace-nowrap px-5 py-4 text-ink-muted">{formatCnpj(row.cnpj)}</td>
          {!isCompany && <td className="px-5 py-4 text-ink-muted">{row.company_id ? companyNames.get(row.company_id) ?? '—' : <span className="text-warn-bright">Sem empresa vinculada</span>}</td>}
          <td className="px-5 py-4 text-ink-muted">{row.city ? `${row.city}${row.state ? ` / ${row.state}` : ''}` : '—'}</td>
          <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${row.active ? 'bg-fresh/10 text-fresh-bright' : 'bg-surface-raised text-ink-muted'}`}>{row.active ? 'Ativa' : 'Inativa'}</span></td>
          <td className="px-5 py-4"><div className="flex flex-wrap gap-3"><Link href={`${path}/${row.id}`} className="text-ember hover:underline">Editar</Link>{isCompany && <Link href={`/cadastros/unidades?company=${row.id}`} className="text-ink-muted hover:text-ember">Ver unidades</Link>}</div></td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-8 text-center text-sm text-ink-muted">{isCompany ? 'Nenhuma empresa encontrada.' : 'Nenhuma unidade encontrada.'}</p>}
      {totalPages > 1 && <div className="flex items-center justify-between gap-3 border-t border-edge px-5 py-3 text-xs text-ink-muted"><span>{result.count} registros · página {page} de {totalPages}</span><div className="flex gap-4">{page > 1 && <Link href={pageHref(page - 1)}>Anterior</Link>}{page < totalPages && <Link href={pageHref(page + 1)}>Próxima</Link>}</div></div>}
    </div>
  </div>
}

export async function BusinessEditor({ kind, id, companyId }: { kind: BusinessKind; id?: string; companyId?: string }) {
  await requireAdmin()
  if (id && !isUuid(id)) notFound()
  const isCompany = kind === 'empresa'
  const path = isCompany ? '/cadastros/empresas' : '/cadastros/unidades'
  const db = createServiceClient()
  const initialQuery = id ? (isCompany ? db.schema('mise').from('companies').select(BUSINESS_COLUMNS) : db.from('units').select(`${BUSINESS_COLUMNS},company_id,address,whatsapp_number`)).eq('id', id).maybeSingle() : Promise.resolve({ data: null, error: null })
  const [result, companyResult] = await Promise.all([initialQuery, isCompany ? Promise.resolve({ data: [], error: null }) : db.schema('mise').from('companies').select('id,name,active').order('name')])
  if (result.error || companyResult.error) throw new Error('Não foi possível carregar o cadastro. Tente novamente.')
  if (id && !result.data) notFound()
  const record = result.data as unknown as (BusinessRegistration & { whatsapp_number?: string | null }) | undefined
  const initial = record ? { ...record, phone: record.phone || record.whatsapp_number || null } : undefined

  return <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
    <Link href={path} className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ember"><ArrowLeft size={15} />{isCompany ? 'Voltar para Empresas' : 'Voltar para Unidades'}</Link>
    <div><h1 className="text-2xl font-bold text-ink">{id ? 'Editar' : 'Nova'} {kind}</h1><p className="mt-2 text-sm text-ink-muted">Preencha os dados de identificação, endereço e contato. Campos com * são obrigatórios.</p></div>
    <BusinessForm kind={kind} initial={initial} companies={(companyResult.data ?? []) as CompanyOption[]} selectedCompanyId={isUuid(companyId) ? companyId : ''} />
  </div>
}
