import { Router, Response } from 'express';
import { queryOne, query } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── GET / — Listar solicitações (filtradas por condomínios do usuário) ──
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const condIds = (req as any).condominioIds as string[];
    if (!condIds?.length) { res.json([]); return; }

    const ph = condIds.map((_, i) => `$${i + 1}`).join(',');
    const rows = await query(
      `SELECT s.*, m.nome as morador_nome, m.bloco, m.apartamento, m.email as morador_email,
              c.nome as condominio_nome, u.nome as respondido_por_nome
       FROM solicitacoes_morador s
       JOIN moradores m ON m.id = s.morador_id
       JOIN condominios c ON c.id = s.condominio_id
       LEFT JOIN usuarios u ON u.id = s.respondido_por
       WHERE s.condominio_id IN (${ph})
       ORDER BY s.criado_em DESC`,
      condIds
    );
    res.json(rows);
  } catch (err: any) {
    console.error('Erro listar solicitações:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /resumo ──
router.get('/resumo', async (req: AuthRequest, res: Response) => {
  try {
    const condIds = (req as any).condominioIds as string[];
    if (!condIds?.length) {
      res.json({ total: 0, abertas: 0, emAndamento: 0, resolvidas: 0, porTipo: [] });
      return;
    }

    const ph = condIds.map((_, i) => `$${i + 1}`).join(',');
    const [counts, porTipo] = await Promise.all([
      queryOne(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'aberta') as abertas,
           COUNT(*) FILTER (WHERE status IN ('em_analise', 'em_andamento')) as em_andamento,
           COUNT(*) FILTER (WHERE status = 'resolvida') as resolvidas
         FROM solicitacoes_morador WHERE condominio_id IN (${ph})`,
        condIds
      ),
      query(
        `SELECT tipo, COUNT(*) as total
         FROM solicitacoes_morador WHERE condominio_id IN (${ph})
         GROUP BY tipo ORDER BY total DESC`,
        condIds
      ),
    ]);

    res.json({
      total: parseInt(counts?.total || '0'),
      abertas: parseInt(counts?.abertas || '0'),
      em_andamento: parseInt(counts?.em_andamento || '0'),
      resolvidas: parseInt(counts?.resolvidas || '0'),
      por_tipo: porTipo,
    });
  } catch (err: any) {
    console.error('Erro resumo solicitações:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /:id ──
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const condIds = (req as any).condominioIds as string[];
    if (!condIds?.length) { res.status(404).json({ error: 'Não encontrado' }); return; }

    const ph = condIds.map((_, i) => `$${i + 2}`).join(',');
    const row = await queryOne(
      `SELECT s.*, m.nome as morador_nome, m.bloco, m.apartamento, m.email as morador_email, m.whatsapp as morador_whatsapp,
              c.nome as condominio_nome, u.nome as respondido_por_nome
       FROM solicitacoes_morador s
       JOIN moradores m ON m.id = s.morador_id
       JOIN condominios c ON c.id = s.condominio_id
       LEFT JOIN usuarios u ON u.id = s.respondido_por
       WHERE s.id = $1 AND s.condominio_id IN (${ph})`,
      [req.params.id, ...condIds]
    );

    if (!row) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }
    res.json(row);
  } catch (err: any) {
    console.error('Erro detalhe solicitação:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── PATCH /:id/responder ──
router.patch('/:id/responder', async (req: AuthRequest, res: Response) => {
  try {
    const { status, resposta } = req.body;
    if (!status) {
      res.status(400).json({ error: 'Status é obrigatório' });
      return;
    }

    const condIds = (req as any).condominioIds as string[];
    if (!condIds?.length) { res.status(404).json({ error: 'Não encontrado' }); return; }

    const ph = condIds.map((_, i) => `$${i + 5}`).join(',');
    const row = await queryOne(
      `UPDATE solicitacoes_morador
       SET status = $1, resposta = COALESCE($2, resposta),
           respondido_por = $3, respondido_em = NOW(), atualizado_em = NOW()
       WHERE id = $4 AND condominio_id IN (${ph})
       RETURNING *`,
      [status, resposta, req.user!.id, req.params.id, ...condIds]
    );

    if (!row) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }
    res.json(row);
  } catch (err: any) {
    console.error('Erro responder solicitação:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── PATCH /:id/converter-os — Converte solicitação em OS ──
router.patch('/:id/converter-os', async (req: AuthRequest, res: Response) => {
  try {
    const condIds = (req as any).condominioIds as string[];
    if (!condIds?.length) { res.status(404).json({ error: 'Não encontrado' }); return; }

    // Buscar solicitação
    const phCond = condIds.map((_, i) => `$${i + 2}`).join(',');
    const sol = await queryOne(
      `SELECT s.*, m.nome as morador_nome, m.bloco, m.apartamento
       FROM solicitacoes_morador s
       JOIN moradores m ON m.id = s.morador_id
       WHERE s.id = $1 AND s.condominio_id IN (${phCond})`,
      [req.params.id, ...condIds]
    );

    if (!sol) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }
    if (sol.ordem_servico_id) {
      res.status(400).json({ error: 'Já convertida em OS' });
      return;
    }

    // Gera protocolo OS
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const protocolo = `OS-${yy}${mm}${dd}-${rand}`;

    // Criar OS
    const descricao = `[Solicitação ${sol.protocolo}] ${sol.descricao || ''}\n\nMorador: ${sol.morador_nome} - Bloco ${sol.bloco || '-'}, Apto ${sol.apartamento || '-'}`;
    const os = await queryOne(
      `INSERT INTO ordens_servico (protocolo, condominio_id, titulo, descricao, tipo, prioridade, status, local, criado_por)
       VALUES ($1, $2, $3, $4, 'corretiva', 'media', 'aberta', $5, $6)
       RETURNING *`,
      [protocolo, sol.condominio_id, sol.titulo, descricao, sol.local, req.user!.id]
    );

    // Vincular e atualizar status da solicitação
    await queryOne(
      `UPDATE solicitacoes_morador
       SET ordem_servico_id = $1, status = 'em_andamento', respondido_por = $2, respondido_em = NOW(), atualizado_em = NOW()
       WHERE id = $3 RETURNING *`,
      [os.id, req.user!.id, req.params.id]
    );

    res.json({ solicitacao_id: sol.id, ordem_servico: os });
  } catch (err: any) {
    console.error('Erro converter solicitação em OS:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
