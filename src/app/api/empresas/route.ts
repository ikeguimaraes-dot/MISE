import { saveBusinessRegistration } from '@/lib/business-registration-server'

export async function POST(request: Request) {
  return saveBusinessRegistration(request, 'empresa')
}
