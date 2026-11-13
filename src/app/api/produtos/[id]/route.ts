import { saveProduct } from '@/lib/product-registration-server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return saveProduct(request, (await params).id)
}
