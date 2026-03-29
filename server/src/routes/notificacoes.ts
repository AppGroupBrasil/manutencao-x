import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/notificacoes — user's notifications
router.get('/', async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT * FROM notificacoes WHERE user_id = $1 ORDER BY criado_em DESC LIMIT 50`,
    [req.user!.id]
  );
  res.json(rows);
});

// GET /api/notificacoes/unread-count
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  const row = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM notificacoes WHERE user_id = $1 AND lida = false',
    [req.user!.id]
  );
  res.json({ count: parseInt(row?.count || '0') });
});

// PATCH /api/notificacoes/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  await execute(
    'UPDATE notificacoes SET lida = true WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id]
  );
  res.json({ ok: true });
});

// POST /api/notificacoes/read-all
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  await execute(
    'UPDATE notificacoes SET lida = true WHERE user_id = $1 AND lida = false',
    [req.user!.id]
  );
  res.json({ ok: true });
});

// DELETE /api/notificacoes/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await execute(
    'DELETE FROM notificacoes WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id]
  );
  res.json({ ok: true });
});

export default router;
