export const maxDuration=60;
import { extrasContext, ExtraError, extraResponseError } from '@/lib/extras/access';
import { dispatchExtraNotifications } from '@/lib/extras/notifications';
import { timingSafeEqual } from 'node:crypto';
export async function POST() {
  try {
    const {session} = await extrasContext();
    if(session.role !== 'admin') throw new ExtraError('Somente diretoria.',403);
    return Response.json(await dispatchExtraNotifications());
  } catch(error) { return extraResponseError(error); }
}
// A scheduler can retry the durable queue using its own secret, never a public URL.
export async function GET(request: Request) {
  const expected = process.env.EXTRAS_NOTIFICATION_CRON_SECRET;
  const received = request.headers.get('authorization') ?? '';
  const a = Buffer.from(received), b = Buffer.from(`Bearer ${expected}`);
  if(!expected || a.length !== b.length || !timingSafeEqual(a,b)) return Response.json({error:'Não autorizado.'},{status:401});
  return Response.json(await dispatchExtraNotifications());
}
