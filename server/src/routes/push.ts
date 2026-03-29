import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getVapidPublicKey, saveSubscription, removeSubscription, isPushEnabled } from '../services/push.js';

const router = Router();

// GET /api/push/vapid-key — retorna a chave pública VAPID
router.get('/vapid-key', (_req: AuthRequest, res: Response) => {
  res.json({ key: getVapidPublicKey(), enabled: isPushEnabled() });
});

// POST /api/push/subscribe — registrar subscription
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ error: 'Subscription inválida' });
    return;
  }
  await saveSubscription(req.user!.id, subscription);
  res.json({ ok: true });
});

// POST /api/push/unsubscribe — remover subscription
router.post('/unsubscribe', async (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint obrigatório' });
    return;
  }
  await removeSubscription(req.user!.id, endpoint);
  res.json({ ok: true });
});

export default router;
