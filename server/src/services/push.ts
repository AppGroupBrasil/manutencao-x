import webpush from 'web-push';
import { query, queryOne, execute } from '../db/database.js';

// VAPID keys — em produção, gerar uma vez e armazenar em env vars
// Gerar: npx web-push generate-vapid-keys
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@manutencaox.com.br';

let pushEnabled = false;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  pushEnabled = true;
  console.log('[Push] Web Push configurado com VAPID keys.');
} else {
  console.log('[Push] VAPID keys não configuradas. Web Push desabilitado. Gere com: npx web-push generate-vapid-keys');
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}

export function isPushEnabled(): boolean {
  return pushEnabled;
}

/** Registra/atualiza uma subscription de push para um usuário */
export async function saveSubscription(userId: string, subscription: any): Promise<void> {
  const endpoint = subscription.endpoint;
  const existing = await queryOne(
    'SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [userId, endpoint]
  );
  if (existing) {
    await execute(
      'UPDATE push_subscriptions SET subscription = $1, atualizado_em = NOW() WHERE user_id = $2 AND endpoint = $3',
      [JSON.stringify(subscription), userId, endpoint]
    );
  } else {
    await execute(
      'INSERT INTO push_subscriptions (user_id, endpoint, subscription) VALUES ($1, $2, $3)',
      [userId, endpoint, JSON.stringify(subscription)]
    );
  }
}

/** Remove uma subscription */
export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await execute('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [userId, endpoint]);
}

/** Envia push notification para um usuário */
export async function sendPush(userId: string, payload: { title: string; body: string; url?: string; icon?: string }): Promise<void> {
  if (!pushEnabled) return;

  const subs = await query<any>(
    'SELECT subscription FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );

  const data = JSON.stringify(payload);

  for (const row of subs) {
    try {
      const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
      await webpush.sendNotification(sub, data);
    } catch (err: any) {
      // Se a subscription expirou ou foi revogada, remover
      if (err.statusCode === 410 || err.statusCode === 404) {
        const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
        await removeSubscription(userId, sub.endpoint).catch(() => {});
      }
    }
  }
}
