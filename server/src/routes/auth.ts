import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { query, queryOne } from '../db/database.js';
import { generateToken, AuthRequest, authMiddleware } from '../middleware/auth.js';
import { checkRateLimit, recordLoginAttempt, auditLog, createNotification } from '../middleware/helpers.js';
import { issueRefreshToken, consumeRefreshToken, revokeAllForUser } from '../services/refreshToken.js';
import { sendEmail, emailResetSenha } from '../services/email.js';
import { validate, loginSchema, registerSchema, selfRegisterSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from '../middleware/validation.js';

const router = Router();

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res: Response) => {
  try {
    const { email, senha } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';

    const { blocked, remaining } = await checkRateLimit(email, ip);
    if (blocked) {
      res.status(429).json({ error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' });
      return;
    }

    const user = await queryOne<any>(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (!user) {
      await recordLoginAttempt(email, ip, false);
      await auditLog(null, 'login_falha', 'usuarios', email, { motivo: 'usuario_nao_encontrado' }, ip).catch(() => {});
      res.status(401).json({ error: 'Credenciais inválidas', remaining: remaining - 1 });
      return;
    }
    if (!user.ativo || user.bloqueado) {
      await auditLog(null, 'login_falha', 'usuarios', user.id, { motivo: 'conta_bloqueada', email }, ip).catch(() => {});
      res.status(403).json({ error: 'Conta desativada ou bloqueada', motivo: user.motivo_bloqueio });
      return;
    }

    const validPassword = await bcrypt.compare(senha, user.senha_hash);
    if (!validPassword) {
      await recordLoginAttempt(email, ip, false);
      await auditLog(null, 'login_falha', 'usuarios', user.id, { motivo: 'senha_incorreta', email }, ip).catch(() => {});
      res.status(401).json({ error: 'Credenciais inválidas', remaining: remaining - 1 });
      return;
    }

    await recordLoginAttempt(email, ip, true);
    await auditLog({ id: user.id, nome: user.nome, role: user.role } as any, 'login', 'usuarios', user.id, {}, ip);

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = await issueRefreshToken(user.id, {
      userAgent: req.headers['user-agent'] as string | undefined,
      ip,
    }).catch(err => { console.error('[REFRESH] Falha ao emitir:', err.message); return null; });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
        administradorId: user.administrador_id,
        supervisorId: user.supervisor_id,
        condominioId: user.condominio_id,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err: any) {
    console.error('[LOGIN ERROR]', err?.message);
    res.status(500).json({ error: 'Erro interno no login' });
  }
});

// POST /api/auth/register (only admin+ can create users)
router.post('/register', authMiddleware, validate(registerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const caller = req.user!;
    const { email, senha, nome, role, cargo, condominioId, supervisorId } = req.body;

    if (!email || !senha || !nome || !role) {
      res.status(400).json({ error: 'email, senha, nome e role são obrigatórios' });
      return;
    }

    // Validar hierarquia
    const roleLevel: Record<string, number> = { master: 4, administrador: 3, supervisor: 2, funcionario: 1 };
    if ((roleLevel[role] ?? 0) >= (roleLevel[caller.role] ?? 0)) {
      res.status(403).json({ error: 'Não pode criar usuário com role igual ou superior' });
      return;
    }

    const exists = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (exists) {
      res.status(409).json({ error: 'Email já cadastrado' });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    let adminId: string | null;
    if (caller.role === 'master') {
      adminId = null;
    } else if (caller.role === 'administrador') {
      adminId = caller.id;
    } else {
      adminId = caller.administrador_id;
    }

    const supId = role === 'funcionario' ? (supervisorId || caller.id) : null;

    const user = await queryOne<any>(
      `INSERT INTO usuarios (email, senha_hash, nome, role, cargo, criado_por, administrador_id, supervisor_id, condominio_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [email, senhaHash, nome, role, cargo || null, caller.id, adminId, supId, condominioId || null]
    );

    res.status(201).json({
      id: user!.id,
      email: user!.email,
      nome: user!.nome,
      role: user!.role,
    });
  } catch (err: any) {
    console.error('[REGISTER ERROR]', err);
    res.status(500).json({ error: 'Erro interno ao registrar usuário' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const u = req.user!;
  res.json({
    id: u.id,
    email: u.email,
    nome: u.nome,
    role: u.role,
    administradorId: u.administrador_id,
    supervisorId: u.supervisor_id,
    condominioId: u.condominio_id,
    ativo: u.ativo,
    bloqueado: u.bloqueado,
  });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, validate(changePasswordSchema), async (req: AuthRequest, res: Response) => {
  const { senhaAtual, novaSenha } = req.body;
  const user = await queryOne<any>('SELECT senha_hash FROM usuarios WHERE id = $1', [req.user!.id]);

  const valid = await bcrypt.compare(senhaAtual, user!.senha_hash);
  if (!valid) {
    res.status(400).json({ error: 'Senha atual incorreta' });
    return;
  }

  const hash = await bcrypt.hash(novaSenha, 12);
  await query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.user!.id]);
  res.json({ ok: true });
});

// POST /api/auth/self-register (public — creates 'administrador' account)
router.post('/self-register', validate(selfRegisterSchema), async (req, res: Response) => {
  try {
    const { email, senha, nome, telefone } = req.body;

    if (!email || !senha || !nome) {
      res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
      return;
    }
    if (senha.length < 8) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres' });
      return;
    }

    const exists = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (exists) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado' });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    const user = await queryOne<any>(
      `INSERT INTO usuarios (email, senha_hash, nome, role, telefone, ativo)
       VALUES ($1, $2, $3, 'administrador', $4, true) RETURNING id, email, nome, role`,
      [email, senhaHash, nome, telefone || null]
    );

    // Notify all masters about the new registration
    try {
      const masters = await query<any>('SELECT id FROM usuarios WHERE role = $1 AND ativo = true', ['master']);
      for (const m of masters) {
        await createNotification(
          m.id,
          'Novo cadastro',
          `${nome} (${email}) se cadastrou na plataforma.`,
          'info',
          '/usuarios'
        );
      }
      await auditLog(null, 'self_register', 'usuarios', user!.id, { email, nome });
    } catch (notifErr) {
      console.error('[SELF-REGISTER] notification/audit error (non-fatal):', notifErr);
    }

    res.status(201).json({
      message: 'Conta criada com sucesso! Você já pode fazer login.',
      user: { id: user!.id, email: user!.email, nome: user!.nome },
    });
  } catch (err: any) {
    console.error('[SELF-REGISTER ERROR]', err);
    res.status(500).json({ error: 'Erro interno ao criar conta' });
  }
});

// POST /api/auth/forgot-password (public — generates reset token)
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Informe o e-mail' });
    return;
  }

  // Always return success to avoid email enumeration
  const user = await queryOne<any>('SELECT id, nome FROM usuarios WHERE email = $1', [email]);

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await query('UPDATE reset_tokens SET used = true WHERE user_id = $1 AND used = false', [user.id]);
    await query(
      'INSERT INTO reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiry]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const emailData = { ...emailResetSenha(user.nome || email, token, `${frontendUrl}/esqueci-senha`), to: email };
    await sendEmail(emailData).catch(err => console.error('[RESET] Erro ao enviar email:', err?.message));
  }

  res.json({ message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.' });
});

// POST /api/auth/reset-password (public — resets password with token)
router.post('/reset-password', validate(resetPasswordSchema), async (req, res: Response) => {
  const { token, novaSenha } = req.body;

  const record = await queryOne<any>(
    `SELECT rt.user_id, rt.expires_at FROM reset_tokens rt
     WHERE rt.token = $1 AND rt.used = false`,
    [token]
  );

  if (!record || new Date(record.expires_at) < new Date()) {
    res.status(400).json({ error: 'Token inválido ou expirado' });
    return;
  }

  const hash = await bcrypt.hash(novaSenha, 12);
  await query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, record.user_id]);
  await query('UPDATE reset_tokens SET used = true WHERE token = $1', [token]);

  res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
});

// POST /api/auth/refresh — rotação de refresh token
router.post('/refresh', async (req, res: Response) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken || typeof refreshToken !== 'string') {
    res.status(400).json({ error: 'refreshToken obrigatório' });
    return;
  }
  const rec = await consumeRefreshToken(refreshToken);
  if (!rec) {
    res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    return;
  }
  const user = await queryOne<any>(
    'SELECT id, email, role, ativo, bloqueado FROM usuarios WHERE id = $1',
    [rec.user_id]
  );
  if (!user || !user.ativo || user.bloqueado) {
    res.status(403).json({ error: 'Conta desativada ou bloqueada' });
    return;
  }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  const newAccess = generateToken({ userId: user.id, email: user.email, role: user.role });
  const newRefresh = await issueRefreshToken(user.id, {
    userAgent: req.headers['user-agent'] as string | undefined,
    ip,
  });
  res.json({ token: newAccess, refreshToken: newRefresh });
});

// POST /api/auth/logout — revoga todos os refresh tokens do usuário
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  await revokeAllForUser(req.user!.id);
  res.json({ ok: true });
});

export default router;
