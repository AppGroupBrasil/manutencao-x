import { Router, Response } from 'express';
import { query } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/relatorios/resumo
router.get('/resumo', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) {
    res.json({ osMensal: [], osPorCondominio: [], custoMensal: [], produtividade: [], satisfacao: [] });
    return;
  }

  const [osMensal, osPorCond, custoMensal, produtividade] = await Promise.all([
    // OS por mês (últimos 6 meses)
    query(`
      SELECT TO_CHAR(criado_em, 'Mon') as mes,
        COUNT(*) FILTER (WHERE tipo = 'limpeza')::int as limpeza,
        COUNT(*) FILTER (WHERE tipo = 'manutencao')::int as manutencao,
        COUNT(*) FILTER (WHERE tipo = 'emergencia')::int as emergencia
      FROM ordens_servico
      WHERE condominio_id = ANY($1) AND criado_em >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(criado_em, 'Mon'), DATE_TRUNC('month', criado_em)
      ORDER BY DATE_TRUNC('month', criado_em)
    `, [ids]),
    // OS por condomínio
    query(`
      SELECT c.nome, COUNT(os.id)::int as os, COALESCE(AVG(os.avaliacao_nota), 0)::numeric(3,1) as avaliacao
      FROM condominios c LEFT JOIN ordens_servico os ON os.condominio_id = c.id
      WHERE c.id = ANY($1)
      GROUP BY c.nome
      ORDER BY os DESC
    `, [ids]),
    // Custos mensais
    query(`
      SELECT TO_CHAR(criado_em, 'Mon') as mes, COALESCE(SUM(COALESCE(custo_material,0)+COALESCE(custo_mao_obra,0)+COALESCE(custo_terceiros,0)), 0)::numeric(10,2) as custo
      FROM ordens_servico
      WHERE condominio_id = ANY($1) AND criado_em >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(criado_em, 'Mon'), DATE_TRUNC('month', criado_em)
      ORDER BY DATE_TRUNC('month', criado_em)
    `, [ids]),
    // Produtividade por funcionário (soma duração real das execuções em horas)
    query(`
      SELECT te.funcionario_nome as funcionario,
        COUNT(*)::int as tarefas,
        COALESCE(SUM(EXTRACT(EPOCH FROM (te.data_conclusao - te.data_inicio)) / 3600), 0)::numeric(10,1) as horas
      FROM tarefas_execucoes te JOIN tarefas_agendadas ta ON ta.id = te.tarefa_id
      WHERE ta.condominio_id = ANY($1) AND te.status = 'realizada'
        AND te.data_execucao >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY te.funcionario_nome
      ORDER BY tarefas DESC LIMIT 10
    `, [ids]),
  ]);

  // Satisfação (distribuição de notas de vistorias/OS)
  const satisfacao = [
    { estrelas: '5★', valor: 0 },
    { estrelas: '4★', valor: 0 },
    { estrelas: '3★', valor: 0 },
    { estrelas: '2★', valor: 0 },
    { estrelas: '1★', valor: 0 },
  ];

  res.json({
    osMensal: osMensal || [],
    osPorCondominio: osPorCond || [],
    custoMensal: custoMensal || [],
    produtividade: produtividade || [],
    satisfacao,
  });
});

export default router;
