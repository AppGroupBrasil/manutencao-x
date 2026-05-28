import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, documentoSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/documentos — Lista documentos com filtros
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }

  const { tipo, status, equipamentoId, fornecedorId, condominioId, vencidos } = req.query;
  const params: any[] = [ids];
  const conditions: string[] = ['d.condominio_id = ANY($1)'];
  let idx = 2;

  if (tipo && tipo !== 'todos') {
    conditions.push(`d.tipo = $${idx}`);
    params.push(tipo);
    idx++;
  }
  if (status && status !== 'todos') {
    conditions.push(`d.status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (equipamentoId && equipamentoId !== 'todos') {
    conditions.push(`d.equipamento_id = $${idx}`);
    params.push(equipamentoId);
    idx++;
  }
  if (fornecedorId && fornecedorId !== 'todos') {
    conditions.push(`d.fornecedor_id = $${idx}`);
    params.push(fornecedorId);
    idx++;
  }
  if (condominioId && condominioId !== 'todos') {
    conditions.push(`d.condominio_id = $${idx}`);
    params.push(condominioId);
    idx++;
  }
  if (vencidos === 'true') {
    conditions.push(`d.data_validade IS NOT NULL AND d.data_validade < CURRENT_DATE`);
  }

  const where = conditions.join(' AND ');
  const rows = await query(
    `SELECT d.*,
            c.nome AS condominio_nome,
            e.nome AS equipamento_nome, e.codigo AS equipamento_codigo,
            f.nome AS fornecedor_nome,
            p.titulo AS plano_titulo
     FROM documentos_tecnicos d
     LEFT JOIN condominios c ON c.id = d.condominio_id
     LEFT JOIN equipamentos e ON e.id = d.equipamento_id
     LEFT JOIN fornecedores f ON f.id = d.fornecedor_id
     LEFT JOIN planos_manutencao p ON p.id = d.plano_id
     WHERE ${where}
     ORDER BY d.criado_em DESC`,
    params
  );
  res.json(rows);
});

// GET /api/documentos/resumo — contagens por tipo e vencimentos
router.get('/resumo', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json({ total: 0, porTipo: [], vencidos: 0, aVencer30: 0 }); return; }

  const [counts] = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE data_validade IS NOT NULL AND data_validade < CURRENT_DATE)::int AS vencidos,
       COUNT(*) FILTER (WHERE data_validade IS NOT NULL AND data_validade BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int AS a_vencer_30
     FROM documentos_tecnicos
     WHERE condominio_id = ANY($1)`,
    [ids]
  );

  const porTipo = await query(
    `SELECT tipo, COUNT(*)::int AS quantidade
     FROM documentos_tecnicos
     WHERE condominio_id = ANY($1)
     GROUP BY tipo
     ORDER BY quantidade DESC`,
    [ids]
  );

  res.json({ ...counts, porTipo });
});

// GET /api/documentos/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne(
    `SELECT d.*,
            c.nome AS condominio_nome,
            e.nome AS equipamento_nome, e.codigo AS equipamento_codigo,
            f.nome AS fornecedor_nome,
            p.titulo AS plano_titulo
     FROM documentos_tecnicos d
     LEFT JOIN condominios c ON c.id = d.condominio_id
     LEFT JOIN equipamentos e ON e.id = d.equipamento_id
     LEFT JOIN fornecedores f ON f.id = d.fornecedor_id
     LEFT JOIN planos_manutencao p ON p.id = d.plano_id
     WHERE d.id = $1 AND d.condominio_id = ANY($2)`,
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Documento não encontrado' }); return; }
  res.json(row);
});

// POST /api/documentos
router.post('/', validate(documentoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const {
    titulo, descricao, tipo, status, arquivoUrl, arquivoNome, arquivoTamanho, arquivoTipo,
    condominioId, equipamentoId, fornecedorId, planoId,
    dataEmissao, dataValidade, tags, versao, observacoes
  } = req.body;

  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso ao condomínio' });
    return;
  }

  const row = await queryOne(
    `INSERT INTO documentos_tecnicos (
      titulo, descricao, tipo, status, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo,
      condominio_id, equipamento_id, fornecedor_id, plano_id,
      data_emissao, data_validade, tags, versao, observacoes, criado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    RETURNING *`,
    [
      titulo, descricao, tipo || 'outro', status || 'vigente',
      arquivoUrl, arquivoNome, arquivoTamanho || 0, arquivoTipo,
      condominioId, equipamentoId || null, fornecedorId || null, planoId || null,
      dataEmissao || null, dataValidade || null, tags || [], versao || '1.0',
      observacoes, req.user!.id
    ]
  );
  res.status(201).json(row);
});

// PUT /api/documentos/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const {
    titulo, descricao, tipo, status, arquivoUrl, arquivoNome, arquivoTamanho, arquivoTipo,
    equipamentoId, fornecedorId, planoId,
    dataEmissao, dataValidade, tags, versao, observacoes
  } = req.body;

  const row = await queryOne(
    `UPDATE documentos_tecnicos SET
      titulo=$1, descricao=$2, tipo=$3, status=$4,
      arquivo_url=$5, arquivo_nome=$6, arquivo_tamanho=$7, arquivo_tipo=$8,
      equipamento_id=$9, fornecedor_id=$10, plano_id=$11,
      data_emissao=$12, data_validade=$13, tags=$14, versao=$15,
      observacoes=$16, atualizado_em=NOW()
     WHERE id=$17 AND condominio_id = ANY($18) RETURNING *`,
    [
      titulo, descricao, tipo, status,
      arquivoUrl, arquivoNome, arquivoTamanho || 0, arquivoTipo,
      equipamentoId || null, fornecedorId || null, planoId || null,
      dataEmissao || null, dataValidade || null, tags || [], versao,
      observacoes, req.params.id, ids
    ]
  );
  if (!row) { res.status(404).json({ error: 'Documento não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/documentos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM documentos_tecnicos WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Documento não encontrado' }); return; }
  res.json({ ok: true });
});

export default router;
