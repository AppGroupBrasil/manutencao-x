import { Router, Response } from 'express';
import { queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { validate, atribuirSchema } from '../middleware/validation.js';
import { createNotification, auditLog } from '../middleware/helpers.js';

const router = Router();

const TABELA: Record<string, { tabela: string; rotulo: string; titulo: string; notifTitulo: string }> = {
  os: { tabela: 'ordens_servico', rotulo: 'Ordem de Serviço', titulo: 'titulo', notifTitulo: 'Nova Ordem de Serviço atribuída a você' },
  checklist: { tabela: 'checklists', rotulo: 'Checklist', titulo: 'local', notifTitulo: 'Novo Checklist atribuído a você' },
  atividade: { tabela: 'quadro_atividades', rotulo: 'Atividade', titulo: 'titulo', notifTitulo: 'Nova Atividade atribuída a você' },
};

router.post('/', requireMinRole('supervisor'), validate(atribuirSchema), async (req: AuthRequest, res: Response) => {
  const { tipo, id, userId } = req.body;
  const cfg = TABELA[tipo];
  if (!cfg) { res.status(400).json({ error: 'Tipo inválido' }); return; }

  const ids: string[] = req.condominioIds!;
  const item = await queryOne<any>(
    `SELECT id, condominio_id, ${cfg.titulo} AS titulo FROM ${cfg.tabela} WHERE id = $1`,
    [id]
  );
  if (!item || !ids.includes(item.condominio_id)) {
    res.status(404).json({ error: `${cfg.rotulo} não encontrada` });
    return;
  }

  const destino = await queryOne<any>(
    'SELECT id, nome, role, ativo, bloqueado, administrador_id, supervisor_id FROM usuarios WHERE id = $1',
    [userId]
  );
  const caller = req.user!;
  const noEscopo =
    !!destino &&
    (caller.role === 'master' ||
      destino.id === caller.id ||
      (caller.role === 'administrador' &&
        (destino.administrador_id === caller.id ||
          (destino.administrador_id === null && destino.role === 'funcionario'))) ||
      (caller.role === 'supervisor' && destino.supervisor_id === caller.id));
  if (!destino || destino.ativo === false || !noEscopo) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }
  if (destino.bloqueado) {
    res.status(409).json({ error: 'Usuário bloqueado' });
    return;
  }

  if (tipo === 'atividade') {
    await execute(
      'UPDATE quadro_atividades SET responsavel_id = $1, responsavel_nome = $2 WHERE id = $3',
      [userId, destino.nome, id]
    );
  } else {
    await execute(`UPDATE ${cfg.tabela} SET responsavel_id = $1 WHERE id = $2`, [userId, id]);
  }

  await createNotification(
    userId,
    cfg.notifTitulo,
    item.titulo || cfg.rotulo,
    'info',
    `/x/${tipo}/${id}`
  ).catch(() => {});
  await auditLog(caller, 'atribuicao_enviada', cfg.tabela, id, { userId }).catch(() => {});

  res.json({ ok: true, nome: destino.nome });
});

export default router;
