import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute, paginate, transaction } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { validate, usuarioUpdateSchema, usuarioBloquearSchema, usuarioResetSenhaSchema } from '../middleware/validation.js';
import { auditLog } from '../middleware/helpers.js';
import { revokeAllForUser } from '../services/refreshToken.js';

const router = Router();

const ROLE_LEVEL: Record<string, number> = { master: 4, administrador: 3, supervisor: 2, funcionario: 1 };

// GET /api/usuarios
router.get('/', requireMinRole('supervisor'), async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;

  const cols = 'id, email, nome, role, ativo, bloqueado, motivo_bloqueio, administrador_id, supervisor_id, condominio_id, avatar_url, telefone, cargo, notificar_os_email, criado_em';
  let result;

  if (user.role === 'master') {
    result = await paginate(
      `SELECT ${cols} FROM usuarios WHERE ativo = true ORDER BY nome`, [], page, pageSize
    );
  } else if (user.role === 'administrador') {
    const rootId = user.administrador_id ?? user.id;
    result = await paginate(
      `SELECT ${cols}
       FROM usuarios WHERE ativo = true AND (administrador_id = $1 OR id = $1 OR id = $2
         OR (administrador_id IS NULL AND role = 'funcionario'))
       ORDER BY nome`,
      [rootId, user.id], page, pageSize
    );
  } else {
    const colsSup = cols.replace(', motivo_bloqueio', '');
    result = await paginate(
      `SELECT ${colsSup}
       FROM usuarios WHERE ativo = true AND (supervisor_id = $1 OR id = $1) ORDER BY nome`,
      [user.id], page, pageSize
    );
  }

  res.json(result);
});

// GET /api/usuarios/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const row = await queryOne<any>(
    `SELECT id, email, nome, role, ativo, bloqueado, motivo_bloqueio, administrador_id, supervisor_id, condominio_id, avatar_url, telefone, cargo, criado_em
     FROM usuarios WHERE id = $1`,
    [req.params.id]
  );
  if (!row) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }

  const user = req.user!;
  // Hierarchy check: can only view users at lower or equal level within own scope
  if (user.role !== 'master') {
    const rootId = user.administrador_id ?? user.id;
    const coGestorRelacionado = user.role === 'administrador' && row.role === 'administrador'
      && (row.administrador_id === user.id || row.id === rootId || row.administrador_id === rootId);
    if (ROLE_LEVEL[row.role] >= ROLE_LEVEL[user.role] && row.id !== user.id && !coGestorRelacionado) {
      res.status(403).json({ error: 'Sem permissão para visualizar este usuário' }); return;
    }
    // Scope check: admin can only see own hierarchy
    if (user.role === 'administrador' && row.id !== user.id && row.id !== rootId
        && row.administrador_id !== user.id && row.administrador_id !== rootId) {
      // Check if it's a funcionario under a supervisor of this admin
      if (row.supervisor_id) {
        const sup = await queryOne<any>('SELECT administrador_id FROM usuarios WHERE id = $1', [row.supervisor_id]);
        if (!sup || (sup.administrador_id !== user.id && sup.administrador_id !== rootId)) {
          res.status(403).json({ error: 'Sem permissão para visualizar este usuário' }); return;
        }
      } else {
        res.status(403).json({ error: 'Sem permissão para visualizar este usuário' }); return;
      }
    }
    if (user.role === 'supervisor' && row.id !== user.id && row.supervisor_id !== user.id) {
      res.status(403).json({ error: 'Sem permissão para visualizar este usuário' }); return;
    }
  }

  res.json(row);
});

// PUT /api/usuarios/:id
router.put('/:id', requireMinRole('administrador'), validate(usuarioUpdateSchema), async (req: AuthRequest, res: Response) => {
  const { nome, role, ativo, condominioId, supervisorId, telefone, cargo } = req.body;

  // Verify target exists and check hierarchy
  const target = await queryOne<any>('SELECT id, role, administrador_id FROM usuarios WHERE id = $1', [req.params.id]);
  if (!target) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  const rootId = req.user!.administrador_id ?? req.user!.id;
  const gerenciaCoGestor = req.user!.role === 'administrador' && target.role === 'administrador'
    && target.administrador_id === req.user!.id;
  if (req.user!.role !== 'master' && ROLE_LEVEL[target.role] >= ROLE_LEVEL[req.user!.role] && !gerenciaCoGestor) {
    res.status(403).json({ error: 'Sem permissão para alterar este usuário' }); return;
  }
  // Admin can only modify users in own hierarchy (or orphan funcionarios, same rule do GET)
  if (req.user!.role === 'administrador' && target.administrador_id !== req.user!.id
      && target.administrador_id !== rootId
      && !(target.administrador_id === null && target.role === 'funcionario')) {
    res.status(403).json({ error: 'Usuário fora do seu escopo' }); return;
  }
  // Novo role precisa ser estritamente inferior ao do caller (master pode tudo abaixo de master; titular mantém co-gestor)
  const promoveGestor = req.user!.role === 'administrador' && role === 'administrador'
    && ROLE_LEVEL[target.role] < ROLE_LEVEL['administrador']
    && (target.administrador_id === req.user!.id || target.administrador_id === rootId);
  if (!((gerenciaCoGestor || promoveGestor) && role === 'administrador') && (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[req.user!.role] ?? 0)) {
    res.status(403).json({ error: 'Não pode atribuir role igual ou superior ao seu' }); return;
  }
  if (condominioId && !req.condominioIds!.includes(condominioId)) {
    res.status(403).json({ error: 'Condomínio fora do seu escopo' }); return;
  }

  const row = await queryOne(
    `UPDATE usuarios SET nome=$1, role=$2, ativo=$3,
       condominio_id=COALESCE($4, condominio_id), supervisor_id=COALESCE($5, supervisor_id),
       telefone=COALESCE($6, telefone), cargo=COALESCE($7, cargo),
       administrador_id=COALESCE($9, administrador_id)
     WHERE id=$8 RETURNING id, email, nome, role, ativo, condominio_id, supervisor_id, telefone, cargo`,
    [nome, role, ativo, condominioId ?? null, supervisorId ?? null, telefone ?? null, cargo ?? null, req.params.id,
     promoveGestor ? rootId : null]
  );
  await auditLog(req.user!, 'usuario_atualizado', 'usuarios', req.params.id, { nome, role, ativo }).catch(() => {});
  res.json(row);
});

// PATCH /api/usuarios/:id/bloquear
router.patch('/:id/bloquear', requireMinRole('administrador'), validate(usuarioBloquearSchema), async (req: AuthRequest, res: Response) => {
  const { bloqueado, motivo } = req.body;
  const targetId = req.params.id;

  const alvo = await queryOne<any>('SELECT role, administrador_id FROM usuarios WHERE id = $1', [targetId]);
  if (!alvo) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  const rootIdBloq = req.user!.administrador_id ?? req.user!.id;
  const bloqueiaCoGestor = req.user!.role === 'administrador' && alvo.role === 'administrador'
    && alvo.administrador_id === req.user!.id;
  if (req.user!.role !== 'master' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[req.user!.role] && !bloqueiaCoGestor) {
    res.status(403).json({ error: 'Sem permissão para alterar este usuário' }); return;
  }
  if (req.user!.role === 'administrador' && alvo.administrador_id !== req.user!.id
      && alvo.administrador_id !== rootIdBloq
      && !(alvo.administrador_id === null && alvo.role === 'funcionario')) {
    res.status(403).json({ error: 'Usuário fora do seu escopo' }); return;
  }

  const result = await transaction(async (client) => {
    const { rows } = await client.query(
      'UPDATE usuarios SET bloqueado = $1, motivo_bloqueio = $2 WHERE id = $3 RETURNING id, bloqueado, role',
      [bloqueado, motivo || null, targetId]
    );
    const row = rows[0];
    if (!row) return null;

    if (row.role === 'administrador') {
      await client.query(
        'UPDATE usuarios SET bloqueado = $1, motivo_bloqueio = $2 WHERE administrador_id = $3',
        [bloqueado, bloqueado ? (motivo || 'Administrador bloqueado') : null, targetId]
      );
      await client.query(
        `UPDATE usuarios SET bloqueado = $1, motivo_bloqueio = $2
         WHERE supervisor_id IN (SELECT id FROM usuarios WHERE administrador_id = $3 AND role = 'supervisor')`,
        [bloqueado, bloqueado ? (motivo || 'Administrador bloqueado') : null, targetId]
      );
      await client.query(
        `UPDATE qrcodes SET ativo = $1
         WHERE condominio_id IN (SELECT id FROM condominios WHERE criado_por = $2)`,
        [!bloqueado, targetId]
      );
      await client.query(
        `UPDATE qrcodes SET ativo = $1
         WHERE criado_por = $2
            OR criado_por IN (SELECT id FROM usuarios WHERE administrador_id = $2)
            OR criado_por IN (
              SELECT id FROM usuarios WHERE supervisor_id IN (
                SELECT id FROM usuarios WHERE administrador_id = $2 AND role = 'supervisor'
              )
            )`,
        [!bloqueado, targetId]
      );
    }

    if (row.role === 'supervisor') {
      await client.query(
        'UPDATE usuarios SET bloqueado = $1, motivo_bloqueio = $2 WHERE supervisor_id = $3',
        [bloqueado, bloqueado ? (motivo || 'Supervisor bloqueado') : null, targetId]
      );
      await client.query(
        `UPDATE qrcodes SET ativo = $1
         WHERE criado_por = $2 OR criado_por IN (SELECT id FROM usuarios WHERE supervisor_id = $2)`,
        [!bloqueado, targetId]
      );
    }

    return row;
  });

  if (!result) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  await auditLog(req.user!, bloqueado ? 'usuario_bloqueado' : 'usuario_desbloqueado', 'usuarios', targetId, { motivo, role: result.role }).catch(() => {});
  res.json(result);
});
router.patch('/:id/reset-senha', requireMinRole('administrador'), validate(usuarioResetSenhaSchema), async (req: AuthRequest, res: Response) => {
  const target = await queryOne<any>('SELECT role, administrador_id FROM usuarios WHERE id = $1', [req.params.id]);
  if (!target) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  const gerenciaCoGestor = req.user!.role === 'administrador' && target.role === 'administrador'
    && target.administrador_id === req.user!.id;
  if (ROLE_LEVEL[target.role] >= ROLE_LEVEL[req.user!.role] && !gerenciaCoGestor) {
    res.status(403).json({ error: 'Sem permissão para alterar este usuário' }); return;
  }
  const { novaSenha } = req.body;
  const hash = await bcrypt.hash(novaSenha, 12);
  await execute('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.params.id]);
  await auditLog(req.user!, 'usuario_reset_senha', 'usuarios', req.params.id).catch(() => {});
  res.json({ ok: true });
});

// PATCH /api/usuarios/:id/notificar-email
router.patch('/:id/notificar-email', requireMinRole('supervisor'), async (req: AuthRequest, res: Response) => {
  const notificar = req.body?.notificar;
  if (typeof notificar !== 'boolean') { res.status(400).json({ error: 'Campo notificar (boolean) obrigatório' }); return; }
  const row = await queryOne(
    `UPDATE usuarios SET notificar_os_email = $1 WHERE id = $2 AND role = 'funcionario' RETURNING id, notificar_os_email`,
    [notificar, req.params.id]
  );
  if (!row) { res.status(404).json({ error: 'Funcionário não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/usuarios/:id
router.delete('/:id', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const target = await queryOne<any>('SELECT role, administrador_id FROM usuarios WHERE id = $1', [req.params.id]);
  if (!target) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  const rootId = req.user!.administrador_id ?? req.user!.id;
  const gerenciaCoGestor = req.user!.role === 'administrador' && target.role === 'administrador'
    && target.administrador_id === req.user!.id;
  if (ROLE_LEVEL[target.role] >= ROLE_LEVEL[req.user!.role] && !gerenciaCoGestor) {
    res.status(403).json({ error: 'Sem permissão para alterar este usuário' }); return;
  }
  if (req.user!.role === 'administrador' && target.administrador_id !== req.user!.id
      && target.administrador_id !== rootId
      && !(target.administrador_id === null && target.role === 'funcionario')) {
    res.status(403).json({ error: 'Usuário fora do seu escopo' }); return;
  }
  await execute('UPDATE usuarios SET ativo = false WHERE id = $1', [req.params.id]);
  await revokeAllForUser(req.params.id).catch(() => {});
  await auditLog(req.user!, 'usuario_desativado', 'usuarios', req.params.id, { role: target.role }).catch(() => {});
  res.json({ ok: true });
});

export default router;
