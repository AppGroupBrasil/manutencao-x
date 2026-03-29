import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/ponto — listar registros de ponto (com filtro de data)
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const data = req.query.data as string; // formato YYYY-MM-DD
  const userId = req.query.userId as string;

  let sql = `SELECT cp.*, u.nome as funcionario_nome, u.cargo as funcionario_cargo
     FROM controle_ponto cp
     LEFT JOIN usuarios u ON u.id = cp.funcionario_id
     WHERE 1=1`;
  const params: any[] = [];
  let i = 1;

  // Filtrar por scope (se não for master, filtrar por condominioIds via join no usuário)
  if (req.user!.role !== 'master') {
    // Funcionários só veem seus próprios registros
    if (req.user!.role === 'funcionario') {
      sql += ` AND cp.funcionario_id = $${i++}`;
      params.push(req.user!.id);
    }
  }

  if (data) {
    sql += ` AND cp.data_hora::date = $${i++}`;
    params.push(data);
  }

  if (userId) {
    sql += ` AND cp.funcionario_id = $${i++}`;
    params.push(userId);
  }

  sql += ' ORDER BY cp.data_hora DESC LIMIT 500';

  const rows = await query(sql, params);
  res.json(rows);
});

// GET /api/ponto/resumo — resumo de ponto do mês atual
router.get('/resumo', async (req: AuthRequest, res: Response) => {
  const userId = (req.query.userId as string) || req.user!.id;

  // Se não for supervisor+, só pode ver próprio resumo
  const roleLevel: Record<string, number> = { master: 4, administrador: 3, supervisor: 2, funcionario: 1 };
  if ((roleLevel[req.user!.role] || 1) < 2 && userId !== req.user!.id) {
    res.status(403).json({ error: 'Sem permissão' });
    return;
  }

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const stats = await queryOne<any>(
    `SELECT
       COUNT(*) FILTER (WHERE tipo = 'entrada') as total_entradas,
       COUNT(*) FILTER (WHERE tipo = 'saida') as total_saidas,
       COUNT(DISTINCT data_hora::date) as dias_trabalhados,
       SUM(CASE WHEN permanencia IS NOT NULL THEN permanencia ELSE 0 END) as minutos_total
     FROM controle_ponto
     WHERE funcionario_id = $1 AND data_hora >= $2`,
    [userId, inicioMes]
  );

  res.json({
    totalEntradas: parseInt(stats?.total_entradas || '0'),
    totalSaidas: parseInt(stats?.total_saidas || '0'),
    diasTrabalhados: parseInt(stats?.dias_trabalhados || '0'),
    horasTotal: Math.round((parseInt(stats?.minutos_total || '0')) / 60 * 10) / 10,
  });
});

// POST /api/ponto — registrar entrada/saída
router.post('/', async (req: AuthRequest, res: Response) => {
  const { tipo, latitude, longitude, endereco } = req.body;

  if (!tipo || !['entrada', 'saida'].includes(tipo)) {
    res.status(400).json({ error: 'Tipo deve ser "entrada" ou "saida"' });
    return;
  }

  let permanencia: number | null = null;

  // Se for saída, calcular permanência desde a última entrada
  if (tipo === 'saida') {
    const ultimaEntrada = await queryOne<any>(
      `SELECT data_hora FROM controle_ponto
       WHERE funcionario_id = $1 AND tipo = 'entrada' AND data_hora::date = CURRENT_DATE
       ORDER BY data_hora DESC LIMIT 1`,
      [req.user!.id]
    );
    if (ultimaEntrada) {
      permanencia = Math.round((Date.now() - new Date(ultimaEntrada.data_hora).getTime()) / 60000);
    }
  }

  const row = await queryOne(
    `INSERT INTO controle_ponto (funcionario_id, nome, email, cargo, tipo, latitude, longitude, endereco, permanencia)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      req.user!.id,
      req.user!.nome,
      req.user!.email,
      (req.user as any).cargo || '',
      tipo,
      latitude || null,
      longitude || null,
      endereco || null,
      permanencia,
    ]
  );

  res.status(201).json(row);
});

export default router;
