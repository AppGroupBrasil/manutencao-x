import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import { query, queryOne, execute, paginate } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { orcamentoSchema, orcamentoItemSchema } from '../middleware/validation.js';

const router = Router();

// ── GET /api/orcamentos — Listar orçamentos ──
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json({ data: [], total: 0, page: 1, pageSize: 20 }); return; }

  const { status, busca } = req.query;
  let where = 'o.condominio_id = ANY($1)';
  const params: any[] = [ids];
  let idx = 2;

  if (status && status !== 'todos') {
    where += ` AND o.status = $${idx}`;
    params.push(status);
    idx++;
  }
  if (busca) {
    where += ` AND (o.titulo ILIKE $${idx} OR o.cliente_nome ILIKE $${idx} OR o.numero::text = $${idx + 1})`;
    params.push(`%${busca}%`, busca);
    idx += 2;
  }

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
  const offset = (page - 1) * pageSize;

  const [countRes] = await query(`SELECT COUNT(*)::int AS total FROM orcamentos o WHERE ${where}`, params);
  const total = countRes?.total || 0;

  const rows = await query(
    `SELECT o.*, c.nome AS condominio_nome, u.nome AS criador_nome
     FROM orcamentos o
     LEFT JOIN condominios c ON c.id = o.condominio_id
     LEFT JOIN usuarios u ON u.id = o.criado_por
     WHERE ${where}
     ORDER BY o.criado_em DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, pageSize, offset]
  );

  res.json({ data: rows, total, page, pageSize });
});

// ── GET /api/orcamentos/:id — Detalhes de um orçamento ──
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const orc = await queryOne<any>(
    `SELECT o.*, c.nome AS condominio_nome, u.nome AS criador_nome
     FROM orcamentos o
     LEFT JOIN condominios c ON c.id = o.condominio_id
     LEFT JOIN usuarios u ON u.id = o.criado_por
     WHERE o.id = $1`,
    [req.params.id]
  );
  if (!orc || !ids.includes(orc.condominio_id)) {
    res.status(404).json({ error: 'Orçamento não encontrado' }); return;
  }

  const itens = await query('SELECT * FROM orcamento_itens WHERE orcamento_id = $1 ORDER BY ordem, id', [orc.id]);
  const fotos = await query('SELECT * FROM orcamento_fotos WHERE orcamento_id = $1 ORDER BY ordem, id', [orc.id]);

  res.json({ ...orc, itens, fotos });
});

// ── POST /api/orcamentos — Criar orçamento ──
router.post('/', validate(orcamentoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const b = req.body;

  if (!ids.includes(b.condominio_id)) {
    res.status(403).json({ error: 'Sem permissão para este condomínio' }); return;
  }

  const orc = await queryOne<any>(
    `INSERT INTO orcamentos (condominio_id, titulo, cliente_nome, cliente_telefone, cliente_email,
       cliente_endereco, descricao_geral, observacoes, condicoes_pagamento, validade_dias,
       prazo_execucao, desconto_tipo, desconto_valor, logo_url, os_referencia, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [b.condominio_id, b.titulo, b.cliente_nome, b.cliente_telefone, b.cliente_email,
     b.cliente_endereco, b.descricao_geral, b.observacoes, b.condicoes_pagamento, b.validade_dias || 30,
     b.prazo_execucao, b.desconto_tipo || 'nenhum', b.desconto_valor || 0, b.logo_url, b.os_referencia,
     req.user!.id]
  );

  // Inserir itens
  if (Array.isArray(b.itens)) {
    for (let i = 0; i < b.itens.length; i++) {
      const it = b.itens[i];
      const vtotal = (it.quantidade || 1) * (it.valor_unitario || 0);
      await execute(
        `INSERT INTO orcamento_itens (orcamento_id, descricao, tipo, quantidade, unidade, valor_unitario, valor_total, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orc.id, it.descricao, it.tipo || 'servico', it.quantidade || 1, it.unidade || 'un', it.valor_unitario || 0, vtotal, i]
      );
    }
  }

  // Inserir fotos
  if (Array.isArray(b.fotos)) {
    for (let i = 0; i < b.fotos.length; i++) {
      const f = b.fotos[i];
      await execute(
        'INSERT INTO orcamento_fotos (orcamento_id, url, legenda, ordem) VALUES ($1,$2,$3,$4)',
        [orc.id, f.url, f.legenda || '', i]
      );
    }
  }

  // Calcular totais
  await recalcularTotais(orc.id);
  const result = await queryOne('SELECT * FROM orcamentos WHERE id = $1', [orc.id]);
  res.status(201).json(result);
});

// ── PUT /api/orcamentos/:id — Atualizar orçamento ──
router.put('/:id', validate(orcamentoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const existing = await queryOne<any>('SELECT * FROM orcamentos WHERE id = $1', [req.params.id]);
  if (!existing || !ids.includes(existing.condominio_id)) {
    res.status(404).json({ error: 'Orçamento não encontrado' }); return;
  }

  const b = req.body;
  await execute(
    `UPDATE orcamentos SET titulo=$1, cliente_nome=$2, cliente_telefone=$3, cliente_email=$4,
       cliente_endereco=$5, descricao_geral=$6, observacoes=$7, condicoes_pagamento=$8,
       validade_dias=$9, prazo_execucao=$10, desconto_tipo=$11, desconto_valor=$12,
       logo_url=$13, os_referencia=$14, atualizado_em=NOW()
     WHERE id=$15`,
    [b.titulo, b.cliente_nome, b.cliente_telefone, b.cliente_email,
     b.cliente_endereco, b.descricao_geral, b.observacoes, b.condicoes_pagamento,
     b.validade_dias || 30, b.prazo_execucao, b.desconto_tipo || 'nenhum', b.desconto_valor || 0,
     b.logo_url, b.os_referencia, req.params.id]
  );

  // Substituir itens
  await execute('DELETE FROM orcamento_itens WHERE orcamento_id = $1', [req.params.id]);
  if (Array.isArray(b.itens)) {
    for (let i = 0; i < b.itens.length; i++) {
      const it = b.itens[i];
      const vtotal = (it.quantidade || 1) * (it.valor_unitario || 0);
      await execute(
        `INSERT INTO orcamento_itens (orcamento_id, descricao, tipo, quantidade, unidade, valor_unitario, valor_total, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.params.id, it.descricao, it.tipo || 'servico', it.quantidade || 1, it.unidade || 'un', it.valor_unitario || 0, vtotal, i]
      );
    }
  }

  // Substituir fotos
  await execute('DELETE FROM orcamento_fotos WHERE orcamento_id = $1', [req.params.id]);
  if (Array.isArray(b.fotos)) {
    for (let i = 0; i < b.fotos.length; i++) {
      const f = b.fotos[i];
      await execute(
        'INSERT INTO orcamento_fotos (orcamento_id, url, legenda, ordem) VALUES ($1,$2,$3,$4)',
        [req.params.id, f.url, f.legenda || '', i]
      );
    }
  }

  await recalcularTotais(req.params.id);
  const result = await queryOne('SELECT * FROM orcamentos WHERE id = $1', [req.params.id]);
  res.json(result);
});

// ── PATCH /api/orcamentos/:id/status — Mudar status ──
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const existing = await queryOne<any>('SELECT * FROM orcamentos WHERE id = $1', [req.params.id]);
  if (!existing || !ids.includes(existing.condominio_id)) {
    res.status(404).json({ error: 'Orçamento não encontrado' }); return;
  }

  const { status } = req.body;
  const validos = ['rascunho', 'enviado', 'aprovado', 'recusado', 'expirado'];
  if (!validos.includes(status)) {
    res.status(400).json({ error: 'Status inválido' }); return;
  }

  await execute('UPDATE orcamentos SET status = $1, atualizado_em = NOW() WHERE id = $2', [status, req.params.id]);
  res.json({ message: 'Status atualizado' });
});

// ── DELETE /api/orcamentos/:id ──
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const existing = await queryOne<any>('SELECT * FROM orcamentos WHERE id = $1', [req.params.id]);
  if (!existing || !ids.includes(existing.condominio_id)) {
    res.status(404).json({ error: 'Orçamento não encontrado' }); return;
  }

  await execute('DELETE FROM orcamentos WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

// ── GET /api/orcamentos/:id/pdf — Gerar PDF do orçamento ──
router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const orc = await queryOne<any>(
    `SELECT o.*, c.nome AS condominio_nome, c.endereco AS condominio_endereco,
            u.nome AS criador_nome
     FROM orcamentos o
     LEFT JOIN condominios c ON c.id = o.condominio_id
     LEFT JOIN usuarios u ON u.id = o.criado_por
     WHERE o.id = $1`,
    [req.params.id]
  );
  if (!orc || !ids.includes(orc.condominio_id)) {
    res.status(404).json({ error: 'Orçamento não encontrado' }); return;
  }

  const itens = await query('SELECT * FROM orcamento_itens WHERE orcamento_id = $1 ORDER BY ordem', [orc.id]);
  const fotos = await query('SELECT * FROM orcamento_fotos WHERE orcamento_id = $1 ORDER BY ordem', [orc.id]);

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=Orcamento-${orc.numero}.pdf`);
  doc.pipe(res);

  // ── Cabeçalho ──
  const fmtBRL = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtData = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  doc.fontSize(22).font('Helvetica-Bold').text('ORÇAMENTO', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(`Nº ${orc.numero}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#3b82f6');
  doc.moveDown();

  // Dados da empresa / condomínio
  doc.font('Helvetica-Bold').fontSize(11).text(orc.condominio_nome || 'Empresa');
  if (orc.condominio_endereco) doc.font('Helvetica').fontSize(9).text(orc.condominio_endereco);
  doc.moveDown();

  // Dados do cliente
  doc.font('Helvetica-Bold').fontSize(11).text('DADOS DO CLIENTE');
  doc.moveDown(0.3);
  const lbl = (t: string) => doc.font('Helvetica-Bold').fontSize(9).text(t, { continued: true });
  const val = (t: string) => doc.font('Helvetica').fontSize(9).text(` ${t || '—'}`);
  if (orc.cliente_nome) { lbl('Nome:'); val(orc.cliente_nome); }
  if (orc.cliente_telefone) { lbl('Telefone:'); val(orc.cliente_telefone); }
  if (orc.cliente_email) { lbl('E-mail:'); val(orc.cliente_email); }
  if (orc.cliente_endereco) { lbl('Endereço:'); val(orc.cliente_endereco); }
  doc.moveDown(0.5);

  // Informações gerais
  lbl('Data:'); val(fmtData(orc.criado_em));
  lbl('Validade:'); val(`${orc.validade_dias} dias`);
  if (orc.prazo_execucao) { lbl('Prazo de Execução:'); val(orc.prazo_execucao); }
  if (orc.os_referencia) { lbl('Ref. OS:'); val(orc.os_referencia); }
  doc.moveDown();

  // Descrição geral
  if (orc.descricao_geral) {
    doc.font('Helvetica-Bold').fontSize(11).text('DESCRIÇÃO DO SERVIÇO');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).text(orc.descricao_geral, { lineGap: 3 });
    doc.moveDown();
  }

  // Tabela de itens
  if (itens.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).text('ITENS DO ORÇAMENTO');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const cols = [50, 250, 320, 370, 430, 490];
    const headers = ['Descrição', 'Tipo', 'Qtd', 'Unitário', 'Total'];

    // Header
    doc.font('Helvetica-Bold').fontSize(8);
    doc.rect(50, tableTop, 495, 18).fill('#3b82f6');
    doc.fillColor('#fff');
    headers.forEach((h, i) => doc.text(h, cols[i] + 4, tableTop + 4, { width: (cols[i + 1] || 545) - cols[i] - 8 }));
    doc.fillColor('#000');

    let y = tableTop + 20;
    doc.font('Helvetica').fontSize(8);
    const tipoLabel: Record<string, string> = { material: 'Material', servico: 'Serviço', mao_de_obra: 'Mão de Obra' };

    for (const item of itens as any[]) {
      if (y > 750) { doc.addPage(); y = 50; }
      const bg = (itens.indexOf(item) % 2 === 0) ? '#f8fafc' : '#fff';
      doc.rect(50, y, 495, 16).fill(bg);
      doc.fillColor('#1a1a2e');
      doc.text(item.descricao, cols[0] + 4, y + 4, { width: 196 });
      doc.text(tipoLabel[item.tipo] || item.tipo, cols[1] + 4, y + 4, { width: 66 });
      doc.text(`${item.quantidade} ${item.unidade}`, cols[2] + 4, y + 4, { width: 46 });
      doc.text(fmtBRL(parseFloat(item.valor_unitario)), cols[3] + 4, y + 4, { width: 56 });
      doc.text(fmtBRL(parseFloat(item.valor_total)), cols[4] + 4, y + 4, { width: 51 });
      y += 18;
    }

    // Totais
    y += 4;
    doc.moveTo(50, y).lineTo(545, y).stroke('#ccc');
    y += 6;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Subtotal:', 380, y); doc.text(fmtBRL(parseFloat(orc.valor_total)), 460, y);
    y += 14;

    if (orc.desconto_tipo !== 'nenhum' && parseFloat(orc.desconto_valor) > 0) {
      const descLabel = orc.desconto_tipo === 'percentual' ? `Desconto (${orc.desconto_valor}%):` : 'Desconto:';
      doc.text(descLabel, 380, y);
      const descValor = orc.desconto_tipo === 'percentual'
        ? parseFloat(orc.valor_total) * parseFloat(orc.desconto_valor) / 100
        : parseFloat(orc.desconto_valor);
      doc.text(`- ${fmtBRL(descValor)}`, 460, y);
      y += 14;
    }

    doc.fontSize(12).fillColor('#3b82f6');
    doc.text('VALOR FINAL:', 370, y); doc.text(fmtBRL(parseFloat(orc.valor_final)), 460, y);
    doc.fillColor('#000');
    doc.moveDown(2);
  }

  // Condições de pagamento
  if (orc.condicoes_pagamento) {
    doc.font('Helvetica-Bold').fontSize(11).text('CONDIÇÕES DE PAGAMENTO');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).text(orc.condicoes_pagamento, { lineGap: 3 });
    doc.moveDown();
  }

  // Observações
  if (orc.observacoes) {
    doc.font('Helvetica-Bold').fontSize(11).text('OBSERVAÇÕES');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).text(orc.observacoes, { lineGap: 3 });
    doc.moveDown();
  }

  // Rodapé
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999')
    .text(`Gerado em ${new Date().toLocaleString('pt-BR')} — Manutenção X`, { align: 'center' });

  doc.end();
});

// ── Função auxiliar para recalcular totais ──
async function recalcularTotais(orcamentoId: string) {
  const [sum] = await query(
    'SELECT COALESCE(SUM(valor_total), 0)::float AS total FROM orcamento_itens WHERE orcamento_id = $1',
    [orcamentoId]
  );
  const valorTotal = sum?.total || 0;

  const orc = await queryOne<any>('SELECT desconto_tipo, desconto_valor FROM orcamentos WHERE id = $1', [orcamentoId]);
  let valorFinal = valorTotal;
  if (orc) {
    if (orc.desconto_tipo === 'percentual') {
      valorFinal = valorTotal - (valorTotal * (parseFloat(orc.desconto_valor) || 0) / 100);
    } else if (orc.desconto_tipo === 'valor') {
      valorFinal = valorTotal - (parseFloat(orc.desconto_valor) || 0);
    }
  }
  if (valorFinal < 0) valorFinal = 0;

  await execute(
    'UPDATE orcamentos SET valor_total = $1, valor_final = $2, atualizado_em = NOW() WHERE id = $3',
    [valorTotal, valorFinal, orcamentoId]
  );
}

export default router;
