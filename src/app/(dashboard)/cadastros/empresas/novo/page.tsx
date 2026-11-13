import { BusinessEditor } from '@/components/business/business-pages'

export default async function Page({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  return <BusinessEditor kind="empresa" companyId={(await searchParams).company} />
}
