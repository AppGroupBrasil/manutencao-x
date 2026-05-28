import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── GET /api/pdf/ordem-servico/:id — gerar PDF de uma OS
router.get('/ordem-servico/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const os = await queryOne<any>(
    `SELECT os.*, c.nome as condominio_nome, u.nome as responsavel_nome, cr.nome as criador_nome
     FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     LEFT JOIN usuarios u ON u.id = os.responsavel_id
     LEFT JOIN usuarios cr ON cr.id = os.criado_por
     WHERE os.id = $1`,
    [req.params.id]
  );

  if (!os || !ids.includes(os.condominio_id)) {
    res.status(404).json({ error: 'OS não encontrada' });
    return;
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=OS-${os.protocolo}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('Ordem de Serviço', { align: 'center' });
  doc.fontSize(14).font('Helvetica').text(os.protocolo, { align: 'center' });
  doc.moveDown();

  // Linha de separação
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
  doc.moveDown(0.5);

  // Informações
  const label = (text: string) => doc.font('Helvetica-Bold').fontSize(10).text(text, { continued: true });
  const value = (text: string) => doc.font('Helvetica').fontSize(10).text(` ${text || '—'}`);

  label('Condomínio:'); value(os.condominio_nome);
  label('Título:'); value(os.titulo);
  label('Tipo:'); value(os.tipo);
  label('Prioridade:'); value(os.prioridade);
  label('Status:'); value(os.status);
  label('Local:'); value(os.local);
  label('Responsável:'); value(os.responsavel_nome);
  label('Criado por:'); value(os.criador_nome);
  label('Data Abertura:'); value(os.data_abertura ? new Date(os.data_abertura).toLocaleString('pt-BR') : '—');
  label('Data Previsão:'); value(os.data_previsao ? new Date(os.data_previsao).toLocaleDateString('pt-BR') : '—');
  label('Data Conclusão:'); value(os.data_conclusao ? new Date(os.data_conclusao).toLocaleString('pt-BR') : '—');

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
  doc.moveDown(0.5);

  // Custos
  doc.font('Helvetica-Bold').fontSize(12).text('Custos');
  doc.moveDown(0.3);
  label('Material:'); value(`R$ ${(os.custo_material || 0).toFixed(2)}`);
  label('Mão de Obra:'); value(`R$ ${(os.custo_mao_obra || 0).toFixed(2)}`);
  label('Terceiros:'); value(`R$ ${(os.custo_terceiros || 0).toFixed(2)}`);
  label('Total:'); value(`R$ ${((os.custo_material || 0) + (os.custo_mao_obra || 0) + (os.custo_terceiros || 0)).toFixed(2)}`);

  if (os.tempo_execucao_min) {
    label('Tempo Execução:'); value(`${os.tempo_execucao_min} min`);
  }

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
  doc.moveDown(0.5);

  // Descrição
  if (os.descricao) {
    doc.font('Helvetica-Bold').fontSize(12).text('Descrição');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).text(os.descricao, { lineGap: 3 });
  }

  if (os.observacoes) {
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(12).text('Observações');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).text(os.observacoes, { lineGap: 3 });
  }

  // Avaliação
  if (os.avaliacao_nota) {
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12).text('Avaliação');
    doc.moveDown(0.3);
    label('Nota:'); value(`${'★'.repeat(os.avaliacao_nota)}${'☆'.repeat(5 - os.avaliacao_nota)}`);
    if (os.avaliacao_comentario) {
      label('Comentário:'); value(os.avaliacao_comentario);
    }
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999')
    .text(`Gerado em ${new Date().toLocaleString('pt-BR')} — Manutenção X`, { align: 'center' });

  doc.end();
});

// ── GET /api/pdf/relatorio-mensal — resumo mensal em PDF
router.get('/relatorio-mensal', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.status(400).json({ error: 'Sem condomínios' }); return; }

  const mes = (req.query.mes as string) || new Date().toISOString().slice(0, 7);
  const inicio = `${mes}-01`;
  const fim = new Date(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]), 0).toISOString().slice(0, 10);

  const stats = await queryOne<any>(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'concluida') as concluidas,
       COUNT(*) FILTER (WHERE status = 'aberta') as abertas,
       COUNT(*) FILTER (WHERE status = 'em_andamento') as em_andamento,
       COALESCE(SUM(custo_material + custo_mao_obra + custo_terceiros), 0) as custo_total,
       COALESCE(AVG(tempo_execucao_min) FILTER (WHERE status = 'concluida'), 0) as tempo_medio
     FROM ordens_servico
     WHERE condominio_id = ANY($1) AND data_abertura >= $2 AND data_abertura <= $3`,
    [ids, inicio, fim]
  );

  const porTipo = await query(
    `SELECT tipo, COUNT(*) as total
     FROM ordens_servico
     WHERE condominio_id = ANY($1) AND data_abertura >= $2 AND data_abertura <= $3
     GROUP BY tipo ORDER BY total DESC`,
    [ids, inicio, fim]
  );

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=Relatorio-${mes}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text('Relatório Mensal de Manutenção', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text(`Período: ${mes}`, { align: 'center' });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ccc');
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(14).text('Resumo');
  doc.moveDown(0.5);

  const label = (t: string) => doc.font('Helvetica-Bold').fontSize(11).text(t, { continued: true });
  const value = (t: string) => doc.font('Helvetica').fontSize(11).text(` ${t}`);

  label('Total de OS:'); value(stats.total);
  label('Concluídas:'); value(stats.concluidas);
  label('Abertas:'); value(stats.abertas);
  label('Em Andamento:'); value(stats.em_andamento);
  label('Custo Total:'); value(`R$ ${parseFloat(stats.custo_total).toFixed(2)}`);
  label('Tempo Médio:'); value(`${Math.round(parseFloat(stats.tempo_medio))} min`);

  if (porTipo.length > 0) {
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(14).text('OS por Tipo');
    doc.moveDown(0.5);
    for (const t of porTipo) {
      label(`${(t as any).tipo}:`); value(`${(t as any).total}`);
    }
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999')
    .text(`Gerado em ${new Date().toLocaleString('pt-BR')} — Manutenção X`, { align: 'center' });

  doc.end();
});

export default router;
