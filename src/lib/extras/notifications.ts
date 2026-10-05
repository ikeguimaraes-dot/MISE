import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// Configure an HTTPS Power Automate/notification webhook in the deployment.
// Delivery is at least once: the receiver must deduplicate by event_id.
export async function dispatchExtraNotifications() {
  const endpoint = process.env.EXTRAS_NOTIFICATION_WEBHOOK;
  if (!endpoint) return { configured: false, delivered: 0 };
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('Webhook precisa usar HTTPS.');
  const db = createServiceClient().schema('mise');
  const batch = await db.rpc('extra_notification_claim');
  if (batch.error) throw new Error('Fila de notificações indisponível.');
  let delivered = 0;
  const deliveries=await Promise.allSettled((batch.data ?? []).map(async (item: {id:string;event_id:string;payload:Record<string,unknown>;lease_token:string;attempts:number}) => {
    let success = false;
    let failure = '';
    try {
      const response = await fetch(url, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': item.event_id,
          ...(process.env.EXTRAS_NOTIFICATION_TOKEN ? { Authorization: `Bearer ${process.env.EXTRAS_NOTIFICATION_TOKEN}` } : {}) },
        body: JSON.stringify({ ...item.payload, link: `${process.env.APP_URL || 'https://mise-backoffice-nine.vercel.app'}${item.payload.link}` }),
      });
      success = response.ok;
      if (!success) failure = `HTTP ${response.status}`;
    } catch { failure = 'Falha de conexão ou tempo limite.'; }
    const saved = await db.from('extra_notification_outbox').update({
      delivered_at: success ? new Date().toISOString() : null,
      lease_until: null, lease_token: null, last_error: success ? null : failure,
      next_attempt_at: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(item.attempts, 7))).toISOString(),
    }).eq('id', item.id).eq('lease_token', item.lease_token);
    if (saved.error) throw new Error('Não foi possível confirmar a entrega.');
    if (success) delivered++;
  }));
  if(deliveries.some(r=>r.status==='rejected'))throw new Error('Algumas entregas continuam pendentes de confirmação.');
  return { configured: true, delivered };
}
