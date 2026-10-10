import { redirect } from 'next/navigation';
import { extrasContext, ExtraError } from '@/lib/extras/access';
import { ExtrasRequesters } from '@/components/extras-real/extras-requesters';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Solicitantes de Extras' };
export default async function Page({ searchParams }: { searchParams: Promise<{ unit_id?: string }> }) {
  let ctx;
  try { ctx = await extrasContext(); } catch (e) { if (e instanceof ExtraError && e.status === 401) redirect('/login'); throw e; }
  if (ctx.session.role !== 'admin') redirect('/extras');
  const ids = [...new Set(ctx.grants.map(g => g.unit_id))];
  const { data, error } = await ctx.db.from('units').select('id,name').in('id', ids).eq('active', true).order('name');
  if (error || !data?.length) return <p className="p-6">Não foi possível carregar as casas.</p>;
  const params = await searchParams;
  return <ExtrasRequesters units={data} initialUnit={data.some(u => u.id === params.unit_id) ? params.unit_id : undefined} />;
}
