import { Router, Response } from 'express';
import { queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';

const router = Router();
const VENCIMENTOS_TIPOS_CHAVE = 'vencimentos_tipos_manutencao';

function parseJsonArray<T>(value?: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Tema ──

// GET /api/configuracoes/tema
router.get('/tema', async (_req: AuthRequest, res: Response) => {
  const row = await queryOne('SELECT * FROM tema_config WHERE id = $1', ['global']);
  res.json(row || {});
});

// PUT /api/configuracoes/tema
router.put('/tema', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const { corPrimaria, corSecundaria, corMenu, corBotao, corFundo, modoEscuro, logoUrl, loginTitulo, loginSubtitulo } = req.body;
  const row = await queryOne(
    `INSERT INTO tema_config (id, cor_primaria, cor_secundaria, cor_menu, cor_botao, cor_fundo, modo_escuro, logo_url, login_titulo, login_subtitulo)
     VALUES ('global', $1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET cor_primaria=$1, cor_secundaria=$2, cor_menu=$3, cor_botao=$4, cor_fundo=$5, modo_escuro=$6, logo_url=$7, login_titulo=$8, login_subtitulo=$9
     RETURNING *`,
    [corPrimaria, corSecundaria, corMenu, corBotao, corFundo, modoEscuro || false, logoUrl, loginTitulo, loginSubtitulo]
  );
  res.json(row);
});

// ── Permissões do Quadro ──

// GET /api/configuracoes/quadro-permissoes
router.get('/quadro-permissoes', async (_req: AuthRequest, res: Response) => {
  const row = await queryOne('SELECT * FROM quadro_permissoes WHERE id = $1', ['global']);
  res.json(row || {});
});

// PUT /api/configuracoes/quadro-permissoes
router.put('/quadro-permissoes', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const { cadastrar, editar, excluir } = req.body;
  const row = await queryOne(
    `INSERT INTO quadro_permissoes (id, cadastrar, editar, excluir)
     VALUES ('global', $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET cadastrar=$1, editar=$2, excluir=$3
     RETURNING *`,
    [JSON.stringify(cadastrar), JSON.stringify(editar), JSON.stringify(excluir)]
  );
  res.json(row);
});

// GET /api/configuracoes/vencimentos-tipos
router.get('/vencimentos-tipos', async (_req: AuthRequest, res: Response) => {
  const row = await queryOne('SELECT valor FROM configuracoes_gerais WHERE chave = $1', [VENCIMENTOS_TIPOS_CHAVE]);
  res.json({ tipos: parseJsonArray(row?.valor) });
});

// PUT /api/configuracoes/vencimentos-tipos
router.put('/vencimentos-tipos', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const tipos = Array.isArray(req.body?.tipos) ? req.body.tipos : [];
  const normalizados = tipos
    .filter((item: any) => item && typeof item.id === 'string' && typeof item.label === 'string')
    .map((item: any) => ({ id: item.id.trim(), label: item.label.trim() }))
    .filter((item: { id: string; label: string }) => item.id.length > 0 && item.label.length > 0);

  const row = await queryOne(
    `INSERT INTO configuracoes_gerais (chave, valor)
     VALUES ($1, $2)
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor
     RETURNING valor`,
    [VENCIMENTOS_TIPOS_CHAVE, JSON.stringify(normalizados)]
  );

  res.json({ tipos: parseJsonArray(row?.valor) });
});

export default router;
