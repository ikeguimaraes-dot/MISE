import { saveBusinessRegistration } from '@/lib/business-registration-server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return saveBusinessRegistration(request, 'unidade', id)
}
