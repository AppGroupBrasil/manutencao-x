import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import pool, { queryOne, query, paginate } from '../db/database.js';
import { generatePortalToken, portalAuthMiddleware, PortalRequest } from '../middleware/portalAuth.js';
import { checkRateLimit, recordLoginAttempt, auditLog } from '../middleware/helpers.js';
import {
  validate,
  portalLoginSchema,
  portalPrimeiroAcessoSchema,
  portalChangePasswordSchema,
  portalPerfilUpdateSchema,
  portalSolicitacaoSchema,
} from '../middleware/validation.js';

const BCRYPT_COST = 12;

const router = Router();

// ════════════════════════════════════════════
// ROTAS PÚBLICAS (sem auth)
// ════════════════════════════════════════════

// ── POST /portal/login ──
router.post('/login', validate(portalLoginSchema), async (req, res: Response) => {
  try {
    const { email, senha } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '';
    const { blocked } = await checkRateLimit(email, ip);
    if (blocked) {
      res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' });
      return;
    }

    const morador = await queryOne(
      `SELECT id, nome, email, senha, condominio_id, bloco, apartamento, whatsapp, perfil, avatar_url, ativo
       FROM moradores WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    if (!morador || !morador.senha) {
      await recordLoginAttempt(email, ip, false);
      res.status(401).json({ error: 'E-mail ou senha inválidos' });
      return;
    }
    if (!morador.ativo) {
      await recordLoginAttempt(email, ip, false);
      res.status(403).json({ error: 'Conta desativada' });
      return;
    }

    const senhaValida = await bcrypt.compare(senha, morador.senha);
    if (!senhaValida) {
      await recordLoginAttempt(email, ip, false);
      await auditLog(null, 'portal_login_falhou', 'morador', morador.id, { email }, ip);
      res.status(401).json({ error: 'E-mail ou senha inválidos' });
      return;
    }

    await recordLoginAttempt(email, ip, true);

    // Atualizar último acesso
    await pool.query('UPDATE moradores SET ultimo_acesso = NOW() WHERE id = $1', [morador.id]);

    const token = generatePortalToken({ moradorId: morador.id, email: morador.email });

    res.json({
      token,
      morador: {
        id: morador.id,
        nome: morador.nome,
        email: morador.email,
        condominio_id: morador.condominio_id,
        bloco: morador.bloco,
        apartamento: morador.apartamento,
        whatsapp: morador.whatsapp,
        perfil: morador.perfil,
        avatar_url: morador.avatar_url,
      },
    });
  } catch (err: any) {
    console.error('Erro login portal:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── POST /portal/primeiro-acesso ──
router.post('/primeiro-acesso', validate(portalPrimeiroAcessoSchema), async (req, res: Response) => {
  try {
    const { token, senha } = req.body;

    const morador = await queryOne(
      `SELECT id, nome, email, condominio_id, ativo, token_acesso_expira_em, token_acesso_usado
       FROM moradores WHERE token_acesso::text = $1`,
      [token]
    );

    if (!morador || morador.token_acesso_usado) {
      res.status(404).json({ error: 'Token inválido ou expirado' });
      return;
    }
    if (morador.token_acesso_expira_em && new Date(morador.token_acesso_expira_em) < new Date()) {
      res.status(404).json({ error: 'Token inválido ou expirado' });
      return;
    }
    if (!morador.ativo) {
      res.status(403).json({ error: 'Conta desativada' });
      return;
    }

    const hash = await bcrypt.hash(senha, BCRYPT_COST);
    await pool.query(
      `UPDATE moradores
         SET senha = $1,
             token_acesso = gen_random_uuid(),
             token_acesso_usado = true,
             token_acesso_expira_em = NULL
       WHERE id = $2`,
      [hash, morador.id]
    );

    const jwtToken = generatePortalToken({ moradorId: morador.id, email: morador.email });

    res.json({
      token: jwtToken,
      morador: {
        id: morador.id,
        nome: morador.nome,
        email: morador.email,
        condominio_id: morador.condominio_id,
      },
    });
  } catch (err: any) {
    console.error('Erro primeiro acesso:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ════════════════════════════════════════════
// ROTAS PROTEGIDAS (morador autenticado)
// ════════════════════════════════════════════
router.use(portalAuthMiddleware);

// ── GET /portal/perfil ──
router.get('/perfil', async (req: PortalRequest, res: Response) => {
  try {
    const morador = await queryOne(
      `SELECT m.id, m.nome, m.email, m.condominio_id, m.bloco, m.apartamento,
              m.whatsapp, m.perfil, m.avatar_url, m.criado_em,
              c.nome as condominio_nome
       FROM moradores m
       LEFT JOIN condominios c ON c.id = m.condominio_id
       WHERE m.id = $1`,
      [req.morador!.id]
    );
    res.json(morador);
  } catch (err: any) {
    console.error('Erro perfil portal:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── PUT /portal/perfil ──
router.put('/perfil', validate(portalPerfilUpdateSchema), async (req: PortalRequest, res: Response) => {
  try {
    const { nome, whatsapp, avatar_url } = req.body;
    const updated = await queryOne(
      `UPDATE moradores SET nome = COALESCE($1, nome), whatsapp = COALESCE($2, whatsapp),
              avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4 RETURNING *`,
      [nome, whatsapp, avatar_url, req.morador!.id]
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Erro atualizar perfil:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── PUT /portal/senha ──
router.put('/senha', validate(portalChangePasswordSchema), async (req: PortalRequest, res: Response) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    const morador = await queryOne('SELECT senha FROM moradores WHERE id = $1', [req.morador!.id]);
    if (!morador?.senha) {
      res.status(400).json({ error: 'Senha não configurada' });
      return;
    }

    const valida = await bcrypt.compare(senha_atual, morador.senha);
    if (!valida) {
      res.status(401).json({ error: 'Senha atual incorreta' });
      return;
    }

    const hash = await bcrypt.hash(nova_senha, BCRYPT_COST);
    await pool.query('UPDATE moradores SET senha = $1 WHERE id = $2', [hash, req.morador!.id]);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err: any) {
    console.error('Erro alterar senha:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /portal/resumo ──
router.get('/resumo', async (req: PortalRequest, res: Response) => {
  try {
    const condId = req.morador!.condominioId;
    const moradorId = req.morador!.id;

    const [comunicados, solicitacoes, condNome] = await Promise.all([
      queryOne(
        `SELECT COUNT(*) as total FROM comunicados WHERE condominio_id = $1`,
        [condId]
      ),
      queryOne(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'aberta') as abertas,
           COUNT(*) FILTER (WHERE status IN ('em_analise', 'em_andamento')) as em_andamento,
           COUNT(*) FILTER (WHERE status = 'resolvida') as resolvidas
         FROM solicitacoes_morador WHERE morador_id = $1`,
        [moradorId]
      ),
      queryOne('SELECT nome FROM condominios WHERE id = $1', [condId]),
    ]);

    res.json({
      condominio_nome: condNome?.nome || '',
      comunicados_total: parseInt(comunicados?.total || '0'),
      solicitacoes_total: parseInt(solicitacoes?.total || '0'),
      solicitacoes_abertas: parseInt(solicitacoes?.abertas || '0'),
      solicitacoes_em_andamento: parseInt(solicitacoes?.em_andamento || '0'),
      solicitacoes_resolvidas: parseInt(solicitacoes?.resolvidas || '0'),
    });
  } catch (err: any) {
    console.error('Erro resumo portal:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /portal/comunicados ──
router.get('/comunicados', async (req: PortalRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(50, parseInt(req.query.pageSize as string) || 20);
    const result = await paginate(
      `SELECT id, tipo, titulo, mensagem, criado_em
       FROM comunicados
       WHERE condominio_id = $1
       ORDER BY criado_em DESC`,
      [req.morador!.condominioId], page, pageSize
    );
    res.json(result);
  } catch (err: any) {
    console.error('Erro comunicados portal:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /portal/solicitacoes ──
router.get('/solicitacoes', async (req: PortalRequest, res: Response) => {
  try {
    const rows = await query(
      `SELECT s.*, u.nome as respondido_por_nome
       FROM solicitacoes_morador s
       LEFT JOIN usuarios u ON u.id = s.respondido_por
       WHERE s.morador_id = $1
       ORDER BY s.criado_em DESC`,
      [req.morador!.id]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('Erro solicitações portal:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── POST /portal/solicitacoes ──
router.post('/solicitacoes', validate(portalSolicitacaoSchema), async (req: PortalRequest, res: Response) => {
  try {
    const { tipo, titulo, descricao, fotos, local } = req.body;

    // Gera protocolo SOL-YYMMDD-XXXX
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const protocolo = `SOL-${yy}${mm}${dd}-${rand}`;

    const row = await queryOne(
      `INSERT INTO solicitacoes_morador (protocolo, morador_id, condominio_id, tipo, titulo, descricao, fotos, local)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [protocolo, req.morador!.id, req.morador!.condominioId, tipo || 'informacao', titulo, descricao, fotos || [], local]
    );
    res.status(201).json(row);
  } catch (err: any) {
    console.error('Erro criar solicitação:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /portal/solicitacoes/:id ──
router.get('/solicitacoes/:id', async (req: PortalRequest, res: Response) => {
  try {
    const row = await queryOne(
      `SELECT s.*, u.nome as respondido_por_nome
       FROM solicitacoes_morador s
       LEFT JOIN usuarios u ON u.id = s.respondido_por
       WHERE s.id = $1 AND s.morador_id = $2`,
      [req.params.id, req.morador!.id]
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

export default router;
