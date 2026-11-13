import { BusinessIndex } from '@/components/business/business-pages'

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; company?: string; page?: string }> }) {
  return <BusinessIndex kind="empresa" filters={await searchParams} />
}
