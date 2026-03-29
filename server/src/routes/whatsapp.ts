import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { validate, whatsappConfigSchema, whatsappEnviarSchema } from '../middleware/validation.js';

const router = Router();

// ── GET /api/whatsapp/config/:condominioId — configuração WhatsApp de um condomínio
router.get('/config/:condominioId', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominioId } = req.params;
  if (!ids.includes(condominioId)) { res.status(403).json({ error: 'Sem acesso a este condomínio' }); return; }

  const config = await queryOne(
    `SELECT * FROM whatsapp_config WHERE condominio_id = $1`,
    [condominioId]
  );
  res.json(config || { condominioId, ativo: false, notificarOsCriada: true, notificarOsConcluida: true, notificarVencimentos: true, notificarComunicados: true });
});

// ── PUT /api/whatsapp/config/:condominioId — salvar/atualizar configuração
router.put('/config/:condominioId', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominioId } = req.params;
  if (!ids.includes(condominioId)) { res.status(403).json({ error: 'Sem acesso a este condomínio' }); return; }

  const { api_url, api_token, numero_remetente, ativo, notificar_os_criada, notificar_os_concluida, notificar_vencimentos, notificar_comunicados } = req.body;

  const row = await queryOne(
    `INSERT INTO whatsapp_config (condominio_id, api_url, api_token, numero_remetente, ativo,
       notificar_os_criada, notificar_os_concluida, notificar_vencimentos, notificar_comunicados)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (condominio_id)
     DO UPDATE SET api_url = $2, api_token = $3, numero_remetente = $4, ativo = $5,
       notificar_os_criada = $6, notificar_os_concluida = $7, notificar_vencimentos = $8,
       notificar_comunicados = $9, atualizado_em = NOW()
     RETURNING *`,
    [condominioId, api_url || null, api_token || null, numero_remetente || null,
      ativo === true, notificar_os_criada !== false, notificar_os_concluida !== false,
      notificar_vencimentos !== false, notificar_comunicados !== false]
  );
  res.json(row);
});

// ── POST /api/whatsapp/enviar — enviar mensagem via WhatsApp
router.post('/enviar', requireMinRole('administrador'), validate(whatsappEnviarSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominio_id, destinatario, mensagem, tipo } = req.body;

  if (!condominio_id || !ids.includes(condominio_id)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  if (!destinatario || !mensagem) {
    res.status(400).json({ error: 'Destinatário e mensagem são obrigatórios' });
    return;
  }

  // Verificar configuração ativa
  const config = await queryOne<any>(
    `SELECT * FROM whatsapp_config WHERE condominio_id = $1 AND ativo = true`,
    [condominio_id]
  );

  if (!config) {
    res.status(400).json({ error: 'WhatsApp não configurado ou inativo para este condomínio' });
    return;
  }

  // Registrar mensagem
  const msg = await queryOne(
    `INSERT INTO whatsapp_mensagens (condominio_id, destinatario, mensagem, tipo, status)
     VALUES ($1, $2, $3, $4, 'pendente')
     RETURNING *`,
    [condominio_id, destinatario, mensagem, tipo || 'texto']
  );

  // Tentar enviar via API configurada
  try {
    if (config.api_url && config.api_token) {
      const response = await fetch(config.api_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_token}`,
        },
        body: JSON.stringify({
          phone: destinatario,
          message: mensagem,
        }),
      });

      if (response.ok) {
        await execute(
          `UPDATE whatsapp_mensagens SET status = 'enviado', enviado_em = NOW() WHERE id = $1`,
          [(msg as any).id]
        );
        res.json({ ...msg, status: 'enviado' });
        return;
      } else {
        const errBody = await response.text();
        await execute(
          `UPDATE whatsapp_mensagens SET status = 'erro', erro = $1 WHERE id = $2`,
          [errBody.slice(0, 500), (msg as any).id]
        );
        res.status(502).json({ error: 'Falha ao enviar pelo provedor WhatsApp', detalhes: errBody.slice(0, 200) });
        return;
      }
    }

    // Sem API configurada — fica pendente para envio manual
    res.json({ ...msg, aviso: 'Mensagem registrada mas API não configurada. Envio pendente.' });
  } catch (err: any) {
    await execute(
      `UPDATE whatsapp_mensagens SET status = 'erro', erro = $1 WHERE id = $2`,
      [err.message?.slice(0, 500) || 'Erro desconhecido', (msg as any).id]
    );
    res.status(502).json({ error: 'Erro ao conectar com provedor WhatsApp', detalhes: err.message });
  }
});

// ── GET /api/whatsapp/mensagens/:condominioId — log de mensagens
router.get('/mensagens/:condominioId', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominioId } = req.params;
  if (!ids.includes(condominioId)) { res.status(403).json({ error: 'Sem acesso a este condomínio' }); return; }

  const rows = await query(
    `SELECT * FROM whatsapp_mensagens
     WHERE condominio_id = $1
     ORDER BY criado_em DESC
     LIMIT 100`,
    [condominioId]
  );
  res.json(rows);
});

// ── POST /api/whatsapp/testar/:condominioId — testar conexão
router.post('/testar/:condominioId', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominioId } = req.params;
  if (!ids.includes(condominioId)) { res.status(403).json({ error: 'Sem acesso a este condomínio' }); return; }

  const config = await queryOne<any>(
    `SELECT * FROM whatsapp_config WHERE condominio_id = $1`,
    [condominioId]
  );

  if (!config || !config.api_url || !config.api_token) {
    res.status(400).json({ ok: false, error: 'Configuração incompleta. Preencha URL da API e token.' });
    return;
  }

  try {
    const response = await fetch(config.api_url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.api_token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      res.json({ ok: true, message: 'Conexão bem-sucedida com o provedor WhatsApp' });
    } else {
      res.json({ ok: false, error: `Provedor retornou status ${response.status}` });
    }
  } catch (err: any) {
    res.json({ ok: false, error: err.message || 'Não foi possível conectar ao provedor' });
  }
});

export default router;
