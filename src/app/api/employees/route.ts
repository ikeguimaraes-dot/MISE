import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMiseRole } from '@/lib/session'
import { employeeRoleLabel, validateEmployeeAccount } from '@/lib/employee-registration'

export async function POST(request: Request) {
  const actor = await requireMiseRole(['admin'])
  if (!actor) return NextResponse.json({ error: 'Somente administradores podem cadastrar usuários.' }, { status: 403 })

  let input: ReturnType<typeof validateEmployeeAccount>
  try {
    input = validateEmployeeAccount(await request.json())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cadastro inválido.' }, { status: 400 })
  }

  const service = createServiceClient()
  const [unit, role] = await Promise.all([
    service.from('units').select('id').eq('id', input.unit_id).eq('active', true).maybeSingle(),
    service.from('roles').select('id, name, description').eq('id', input.role_id).maybeSingle(),
  ])
  if (unit.error || role.error) return NextResponse.json({ error: 'Não foi possível validar a unidade e o cargo.' }, { status: 503 })
  if (!unit.data || !role.data) return NextResponse.json({ error: 'Unidade ou cargo indisponível.' }, { status: 400 })

  const account = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: [input.nome, input.sobrenome].filter(Boolean).join(' ') },
  })
  if (account.error || !account.data.user) {
    const code = account.error?.code
    const duplicate = code === 'email_exists' || code === 'user_already_exists'
    return NextResponse.json({ error: duplicate ? 'Já existe um usuário com este e-mail.' : code === 'weak_password' ? 'A senha não atende à política do banco de dados.' : 'Não foi possível criar o usuário.' }, { status: duplicate ? 409 : 422 })
  }

  const accountId = account.data.user.id
  const saved = await service.from('employees').insert({
    user_id: accountId,
    nome: input.nome,
    sobrenome: input.sobrenome,
    email: input.email,
    unit_id: input.unit_id,
    role_id: role.data.id,
    funcao: employeeRoleLabel(role.data),
    data_admissao: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
    ativo: true,
    mise_ativo: true,
  }).select('id').single()

  if (saved.error || !saved.data) {
    // Avoid leaving a usable Auth account without its employee/access record.
    const cleanup = await service.auth.admin.deleteUser(accountId)
    if (cleanup.error) {
      await service.auth.admin.updateUserById(accountId, { ban_duration: '876000h' })
      console.error('Employee account rollback requires review', { accountId })
    }
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro do funcionário. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ id: saved.data.id }, { status: 201 })
}
