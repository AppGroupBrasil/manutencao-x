import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { auditLog } from '../middleware/helpers.js';

const router = Router();

// GET /api/perfil — current user profile
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = await queryOne(
      `SELECT id, email, nome, role, telefone, cargo, avatar_url, criado_em FROM usuarios WHERE id = $1`,
      [req.user!.id]
    );
    res.json(user);
  } catch (err) {
    console.error('Erro GET /perfil:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/perfil — update profile
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const { nome, telefone, cargo } = req.body;
    const user = await queryOne(
      `UPDATE usuarios SET nome = COALESCE($1, nome), telefone = COALESCE($2, telefone), cargo = COALESCE($3, cargo), atualizado_em = NOW()
       WHERE id = $4 RETURNING id, email, nome, role, telefone, cargo, avatar_url`,
      [nome || null, telefone || null, cargo || null, req.user!.id]
    );
    await auditLog(req.user!, 'perfil_atualizado', 'usuarios', req.user!.id, { nome, telefone, cargo });
    res.json(user);
  } catch (err) {
    console.error('Erro PUT /perfil:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/perfil/senha — change password
router.put('/senha', async (req: AuthRequest, res: Response) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) { res.status(400).json({ error: 'Senha atual e nova são obrigatórias' }); return; }
    if (novaSenha.length < 6) { res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' }); return; }

    const user = await queryOne<any>('SELECT senha_hash FROM usuarios WHERE id = $1', [req.user!.id]);
    if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    const valid = await bcrypt.compare(senhaAtual, user.senha_hash);
    if (!valid) { res.status(400).json({ error: 'Senha atual incorreta' }); return; }

    const hash = await bcrypt.hash(novaSenha, 12);
    await query('UPDATE usuarios SET senha_hash = $1, atualizado_em = NOW() WHERE id = $2', [hash, req.user!.id]);
    await auditLog(req.user!, 'senha_alterada', 'usuarios', req.user!.id);
    res.json({ ok: true, message: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error('Erro PUT /perfil/senha:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/perfil/avatar — update avatar URL
router.put('/avatar', async (req: AuthRequest, res: Response) => {
  try {
    const { avatarUrl } = req.body;
    if (avatarUrl && !String(avatarUrl).startsWith('/uploads/')) {
      res.status(400).json({ error: 'URL de avatar inválida' });
      return;
    }
    const user = await queryOne(
      'UPDATE usuarios SET avatar_url = $1, atualizado_em = NOW() WHERE id = $2 RETURNING id, avatar_url',
      [avatarUrl || null, req.user!.id]
    );
    res.json(user);
  } catch (err) {
    console.error('Erro PUT /perfil/avatar:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
