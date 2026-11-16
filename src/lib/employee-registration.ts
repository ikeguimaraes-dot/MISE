import { isUuid } from '@/lib/business-registration'

export type EmployeeRole = { id: string; name: string; description: string | null; permissions: unknown }

export function employeeRoleLabel(role: Pick<EmployeeRole, 'name' | 'description'>): string {
  return role.name === 'founder' ? 'Administrador master' : role.description || role.name
}

export function validateEmployeeAccount(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Cadastro inválido.')
  const body = input as Record<string, unknown>
  const text = (key: string) => typeof body[key] === 'string' ? body[key].trim() : ''
  const nome = text('nome')
  const sobrenome = text('sobrenome')
  const email = text('email').toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  if (!nome || nome.length > 100 || sobrenome.length > 150) throw new Error('Informe o nome e confira o sobrenome.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Informe um e-mail válido.')
  if (password.length < 6 || password.length > 256) throw new Error('A senha deve ter entre 6 e 256 caracteres.')
  if (!isUuid(body.unit_id) || !isUuid(body.role_id)) throw new Error('Selecione uma unidade e um cargo válidos.')
  return { nome, sobrenome, email, password, unit_id: body.unit_id, role_id: body.role_id }
}
