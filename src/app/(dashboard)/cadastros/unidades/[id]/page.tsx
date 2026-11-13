import { BusinessEditor } from '@/components/business/business-pages'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <BusinessEditor kind="unidade" id={(await params).id} />
}
