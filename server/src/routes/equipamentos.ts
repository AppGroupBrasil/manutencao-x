import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, equipamentoSchema } from '../middleware/validation.js';

const router = Router();

function gerarCodigo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `EQP-${y}${m}-${r}`;
}

// GET /api/equipamentos
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT e.*, c.nome as condominio_nome, f.nome as fornecedor_nome
     FROM equipamentos e
     LEFT JOIN condominios c ON c.id = e.condominio_id
     LEFT JOIN fornecedores f ON f.id = e.fornecedor_id
     WHERE e.condominio_id = ANY($1)
     ORDER BY e.nome`,
    [ids]
  );
  res.json(rows);
});

// GET /api/equipamentos/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    `SELECT e.*, c.nome as condominio_nome, f.nome as fornecedor_nome
     FROM equipamentos e
     LEFT JOIN condominios c ON c.id = e.condominio_id
     LEFT JOIN fornecedores f ON f.id = e.fornecedor_id
     WHERE e.id = $1 AND e.condominio_id = ANY($2)`,
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Equipamento não encontrado' }); return; }
  res.json(row);
});

// POST /api/equipamentos
router.post('/', validate(equipamentoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const {
    nome, descricao, categoria, marca, modelo, numeroSerie,
    localizacao, andar, dataInstalacao, dataGarantia, vidaUtilAnos,
    potencia, fabricante, fornecedorId, manualUrl, fotoUrl,
    qrcodeId, status, observacoes, condominioId
  } = req.body;

  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso ao condomínio' });
    return;
  }

  const codigo = gerarCodigo();
  const row = await queryOne(
    `INSERT INTO equipamentos (
      codigo, nome, descricao, categoria, marca, modelo, numero_serie,
      localizacao, andar, data_instalacao, data_garantia, vida_util_anos,
      potencia, fabricante, fornecedor_id, manual_url, foto_url,
      qrcode_id, status, observacoes, condominio_id, criado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    RETURNING *`,
    [
      codigo, nome, descricao, categoria || 'outro', marca, modelo, numeroSerie,
      localizacao, andar, dataInstalacao || null, dataGarantia || null, vidaUtilAnos || null,
      potencia, fabricante, fornecedorId || null, manualUrl, fotoUrl,
      qrcodeId || null, status || 'ativo', observacoes, condominioId, req.user!.id
    ]
  );
  res.status(201).json(row);
});

// PUT /api/equipamentos/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const {
    nome, descricao, categoria, marca, modelo, numeroSerie,
    localizacao, andar, dataInstalacao, dataGarantia, vidaUtilAnos,
    potencia, fabricante, fornecedorId, manualUrl, fotoUrl,
    qrcodeId, status, observacoes
  } = req.body;

  const row = await queryOne(
    `UPDATE equipamentos SET
      nome=$1, descricao=$2, categoria=$3, marca=$4, modelo=$5, numero_serie=$6,
      localizacao=$7, andar=$8, data_instalacao=$9, data_garantia=$10, vida_util_anos=$11,
      potencia=$12, fabricante=$13, fornecedor_id=$14, manual_url=$15, foto_url=$16,
      qrcode_id=$17, status=$18, observacoes=$19, atualizado_em=NOW()
     WHERE id=$20 AND condominio_id = ANY($21) RETURNING *`,
    [
      nome, descricao, categoria, marca, modelo, numeroSerie,
      localizacao, andar, dataInstalacao || null, dataGarantia || null, vidaUtilAnos,
      potencia, fabricante, fornecedorId || null, manualUrl, fotoUrl,
      qrcodeId || null, status, observacoes, req.params.id, ids
    ]
  );
  if (!row) { res.status(404).json({ error: 'Equipamento não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/equipamentos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  await execute('DELETE FROM equipamentos WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
  res.json({ ok: true });
});

// ── Histórico de Manutenção do Equipamento ──

// GET /api/equipamentos/:id/historico
router.get('/:id/historico', async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT h.*, f.nome as fornecedor_nome_rel
     FROM equipamentos_historico h
     LEFT JOIN fornecedores f ON f.id = h.fornecedor_id
     WHERE h.equipamento_id = $1
     ORDER BY h.data_servico DESC`,
    [req.params.id]
  );
  res.json(rows);
});

// POST /api/equipamentos/:id/historico
router.post('/:id/historico', async (req: AuthRequest, res: Response) => {
  const { tipo, descricao, dataServico, custo, fornecedorId, fornecedorNome, tecnico, osId, fotos, observacoes } = req.body;
  const row = await queryOne(
    `INSERT INTO equipamentos_historico (
      equipamento_id, tipo, descricao, data_servico, custo,
      fornecedor_id, fornecedor_nome, tecnico, os_id, fotos, observacoes, realizado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      req.params.id, tipo || 'manutencao', descricao, dataServico || new Date(),
      custo || 0, fornecedorId || null, fornecedorNome, tecnico,
      osId || null, fotos || [], observacoes, req.user!.id
    ]
  );
  res.status(201).json(row);
});

export default router;
