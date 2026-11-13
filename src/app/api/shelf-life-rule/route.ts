import { NextResponse } from 'next/server'
import { resolveShelfLifeRule } from '@/lib/shelf-life-server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  try {
    const rule = await resolveShelfLifeRule({ method: searchParams.get('metodo') ?? '', category: searchParams.get('categoria'), ingredientId: searchParams.get('ingredient_id') })
    return NextResponse.json(rule)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível calcular a validade.' }, { status: 422 })
  }
}
