import { query, queryOne } from '../db/database.js';
import { createNotification } from '../middleware/helpers.js';
import { sendPush } from './push.js';
import { sendEmail, emailOSCriada, emailOSStatus } from './email.js';

interface Gestor {
  id: string;
  nome: string;
  email: string | null;
  notificar_os_email: boolean;
  notificar_os_push: boolean;
}

export interface OSResumo {
  id: string;
  protocolo: string;
  titulo: string;
  condominioId: string;
  prioridade?: string | null;
}

/** Quem já foi avisado, para os outros disparos da mesma OS não duplicarem */
export interface Notificados {
  ids: string[];
  emails: string[];
}

const VAZIO: Notificados = { ids: [], emails: [] };
const LINK_OS = '/ordens-servico';

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

function urlAbsoluta(link: string): string {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  return base ? `${base}${link}` : link;
}

/**
 * Gestores do condomínio: o titular (quem criou o condomínio) mais os co-gestores
 * e administradores vinculados a ele ou ao próprio condomínio.
 */
async function listarGestores(condominioId: string, excluirId?: string | null): Promise<Gestor[]> {
  return query<Gestor>(
    `SELECT DISTINCT u.id, u.nome, u.email, u.notificar_os_email, u.notificar_os_push
       FROM condominios c
       JOIN usuarios u ON (
         u.id = c.criado_por
         OR (u.role = 'administrador' AND (u.administrador_id = c.criado_por OR u.condominio_id = c.id))
       )
      WHERE c.id = $1 AND u.ativo = true AND u.bloqueado = false
        AND ($2::uuid IS NULL OR u.id <> $2::uuid)`,
    [condominioId, excluirId ?? null]
  );
}

async function nomeCondominio(condominioId: string): Promise<string> {
  const row = await queryOne<{ nome: string }>('SELECT nome FROM condominios WHERE id = $1', [condominioId]);
  return row?.nome || 'Condomínio';
}

async function despachar(
  gestores: Gestor[],
  dados: { titulo: string; corpo: string; tipo: string; assunto: string; html: string; text: string }
): Promise<Notificados> {
  const ids: string[] = [];
  const emails: string[] = [];
  for (const g of gestores) {
    ids.push(g.id);
    await createNotification(g.id, dados.titulo, dados.corpo, dados.tipo, LINK_OS).catch(() => {});
    if (g.notificar_os_push) {
      await sendPush(g.id, { title: dados.titulo, body: dados.corpo, url: LINK_OS }).catch(() => {});
    }
    if (g.notificar_os_email && g.email) {
      emails.push(g.email);
      await sendEmail({ to: g.email, subject: dados.assunto, html: dados.html, text: dados.text }).catch(() => {});
    }
  }
  return { ids, emails };
}

/** Avisa os gestores do condomínio que uma OS foi aberta. */
export async function notificarGestoresOSCriada(os: OSResumo, autorId?: string | null): Promise<Notificados> {
  const [gestores, condominioNome] = await Promise.all([
    listarGestores(os.condominioId, autorId),
    nomeCondominio(os.condominioId),
  ]);
  if (gestores.length === 0) return VAZIO;

  const template = emailOSCriada(os.protocolo, os.titulo, condominioNome, os.prioridade || 'media', urlAbsoluta(LINK_OS));
  return despachar(gestores, {
    titulo: `Nova OS ${os.protocolo}`,
    corpo: `${os.titulo} — ${condominioNome}`,
    tipo: 'info',
    assunto: template.subject,
    html: template.html,
    text: template.text || '',
  });
}

/** Avisa os gestores do condomínio que o status de uma OS mudou. */
export async function notificarGestoresOSStatus(
  os: OSResumo,
  statusAnterior: string,
  statusNovo: string,
  autorId?: string | null
): Promise<Notificados> {
  if (statusAnterior === statusNovo) return VAZIO;
  const [gestores, condominioNome] = await Promise.all([
    listarGestores(os.condominioId, autorId),
    nomeCondominio(os.condominioId),
  ]);
  if (gestores.length === 0) return VAZIO;

  const label = STATUS_LABEL[statusNovo] || statusNovo;
  const template = emailOSStatus(os.protocolo, os.titulo, condominioNome, statusAnterior, statusNovo, urlAbsoluta(LINK_OS));
  return despachar(gestores, {
    titulo: `OS ${os.protocolo}: ${label}`,
    corpo: `${os.titulo} — ${condominioNome}`,
    tipo: statusNovo === 'concluida' ? 'sucesso' : 'info',
    assunto: template.subject,
    html: template.html,
    text: template.text || '',
  });
}
