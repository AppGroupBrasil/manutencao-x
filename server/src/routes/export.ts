import { Router, Response } from 'express';
import { query } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/export?entidade=ordens-servico&formato=csv
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const entidade = req.query.entidade as string;
  const formato = (req.query.formato as string) || 'csv';

  if (!entidade) {
    res.status(400).json({ error: 'Parâmetro "entidade" obrigatório' });
    return;
  }
  if (ids.length === 0) {
    res.status(400).json({ error: 'Nenhum condomínio no escopo' });
    return;
  }

  let rows: any[];
  let filename: string;

  switch (entidade) {
    case 'ordens-servico':
      rows = await query(
        `SELECT os.protocolo, os.titulo, os.descricao, os.tipo, os.prioridade, os.status,
                os.data_abertura, os.data_conclusao, os.custo_material, os.custo_mao_obra, os.custo_terceiros,
                c.nome as condominio, u.nome as responsavel
         FROM ordens_servico os
         LEFT JOIN condominios c ON c.id = os.condominio_id
         LEFT JOIN usuarios u ON u.id = os.responsavel_id
         WHERE os.condominio_id = ANY($1)
         ORDER BY os.data_abertura DESC`,
        [ids]
      );
      filename = 'ordens-servico';
      break;

    case 'equipamentos':
      rows = await query(
        `SELECT e.codigo, e.nome, e.categoria, e.fabricante, e.modelo, e.numero_serie,
                e.status, e.localizacao, e.data_aquisicao, e.custo_aquisicao,
                c.nome as condominio
         FROM equipamentos e
         LEFT JOIN condominios c ON c.id = e.condominio_id
         WHERE e.condominio_id = ANY($1)
         ORDER BY e.nome`,
        [ids]
      );
      filename = 'equipamentos';
      break;

    case 'materiais':
      rows = await query(
        `SELECT m.nome, m.categoria, m.unidade, m.quantidade, m.estoque_minimo,
                m.preco_unitario, c.nome as condominio
         FROM materiais m
         LEFT JOIN condominios c ON c.id = m.condominio_id
         WHERE m.condominio_id = ANY($1)
         ORDER BY m.nome`,
        [ids]
      );
      filename = 'materiais';
      break;

    case 'fornecedores':
      rows = await query(
        `SELECT f.nome, f.tipo, f.cnpj_cpf, f.email, f.telefone, f.especialidade,
                f.status, f.avaliacao_media, f.total_servicos,
                f.contrato_valor, f.contrato_inicio, f.contrato_fim,
                c.nome as condominio
         FROM fornecedores f
         LEFT JOIN condominios c ON c.id = f.condominio_id
         WHERE f.condominio_id = ANY($1)
         ORDER BY f.nome`,
        [ids]
      );
      filename = 'fornecedores';
      break;

    case 'vencimentos':
      rows = await query(
        `SELECT v.titulo, v.tipo_documento, v.data_validade, v.status, v.responsavel,
                v.observacoes, c.nome as condominio
         FROM vencimentos v
         LEFT JOIN condominios c ON c.id = v.condominio_id
         WHERE v.condominio_id = ANY($1)
         ORDER BY v.data_validade`,
        [ids]
      );
      filename = 'vencimentos';
      break;

    case 'moradores':
      rows = await query(
        `SELECT m.nome, m.email, m.telefone, m.unidade, m.bloco, m.tipo,
                c.nome as condominio
         FROM moradores m
         LEFT JOIN condominios c ON c.id = m.condominio_id
         WHERE m.condominio_id = ANY($1)
         ORDER BY m.nome`,
        [ids]
      );
      filename = 'moradores';
      break;

    default:
      res.status(400).json({ error: `Entidade "${entidade}" não suportada para exportação` });
      return;
  }

  if (rows.length === 0) {
    res.status(404).json({ error: 'Nenhum dado encontrado para exportar' });
    return;
  }

  if (formato === 'csv') {
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(';'))
    ];
    const csvContent = '\ufeff' + csvLines.join('\n'); // BOM para Excel interpretar UTF-8

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } else {
    // JSON fallback
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(rows);
  }
});

export default router;
