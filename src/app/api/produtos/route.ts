import { saveProduct } from '@/lib/product-registration-server'

export async function POST(request: Request) {
  return saveProduct(request)
}
