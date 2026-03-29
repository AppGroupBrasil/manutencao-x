/**
 * Templates de e-mail para Comunicados e Avisos
 *
 * Gera HTML responsivo para envio por e-mail.
 * Em produção, estes templates seriam usados no backend (Node.js, etc.)
 * para compor o corpo do e-mail enviado via SendGrid/AWS SES/Mailgun.
 */

interface EmailTemplateParams {
  tipo: 'comunicado' | 'aviso';
  titulo: string;
  mensagem: string;
  condominio: string;
  destinatarioNome: string;
  enviadoPor: string;
  data: string;
  pdfNome?: string;
  corPrimaria?: string;
  logoUrl?: string;
  nomeApp?: string;
}

function obterCorPrimaria(): string {
  try {
    const saved = localStorage.getItem('manutencao_tema');
    if (saved) {
      const tema = JSON.parse(saved);
      return tema.corPrimaria || '#2563eb';
    }
  } catch { /* ignore */ }
  return '#2563eb';
}

function obterLogo(): string | undefined {
  try {
    const saved = localStorage.getItem('manutencao_tema');
    if (saved) {
      const tema = JSON.parse(saved);
      return tema.logoUrl || undefined;
    }
  } catch { /* ignore */ }
  return undefined;
}

/** Escapa HTML para evitar XSS */
function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, c => map[c]);
}

/** Converte quebras de linha em <br> */
function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Gera o HTML completo do e-mail de aviso rápido
 */
export function gerarEmailAviso(params: EmailTemplateParams): string {
  const cor = params.corPrimaria || obterCorPrimaria();
  const logo = params.logoUrl || obterLogo();
  const app = params.nomeApp || 'Manutenção X';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radiu":12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);s>
          <!-- Header -->
          <tr>
            <td style="background:${escapeHtml(cor)};padding:28px 32px;text-align:center;">
              ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(app)}" style="max-height:48px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />` : ''}
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">⚡ Aviso Rápido</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Olá, <strong style="color:#1f2937;">${escapeHtml(params.destinatarioNome)}</strong></p>
              <h2 style="margin:0 0 20px;font-size:22px;color:#1f2937;font-weight:700;">${escapeHtml(params.titulo)}</h2>
              <div style="padding:20px;background:#f9fafb;border-radiu":10px;border-left:4px solid ${escapeHtml(cor)};margin-bottom:24px;s>
                <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">${nl2br(params.mensagem)}</p>
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">
                <tr>
                  <td style="padding:6px 0;font-size:12.5px;color:#9ca3af;">Condomínio</td>
                  <td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600;text-align:right;">${escapeHtml(params.condominio)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12.5px;color:#9ca3af;">Enviado por</td>
                  <td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600;text-align:right;">${escapeHtml(params.enviadoPor)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12.5px;color:#9ca3af;">Data</td>
                  <td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600;text-align:right;">${escapeHtml(params.data)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:11.5px;color:#9ca3af;line-height:1.6;">
                Este e-mail foi enviado automaticamente pelo sistema <strong>${escapeHtml(app)}</strong>.<br>
                ${escapeHtml(params.condominio)} — Gestão e Manutenção Predial
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Gera o HTML completo do e-mail de comunicado (com PDF anexo)
 */
export function gerarEmailComunicado(params: EmailTemplateParams): string {
  const cor = params.corPrimaria || obterCorPrimaria();
  const logo = params.logoUrl || obterLogo();
  const app = params.nomeApp || 'Manutenção X';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radiu":12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);s>
          <!-- Header -->
          <tr>
            <td style="background:${escapeHtml(cor)};padding:28px 32px;text-align:center;">
              ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(app)}" style="max-height:48px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />` : ''}
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">📄 Comunicado Oficial</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Olá, <strong style="color:#1f2937;">${escapeHtml(params.destinatarioNome)}</strong></p>
              <h2 style="margin:0 0 20px;font-size:22px;color:#1f2937;font-weight:700;">${escapeHtml(params.titulo)}</h2>
              ${params.mensagem ? `
              <div style="padding:20px;background:#f9fafb;border-radiu":10px;border-left:4px solid ${escapeHtml(cor)};margin-bottom:24px;s>
                <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">${nl2br(params.mensagem)}</p>
              </div>` : ''}
              ${params.pdfNome ? `
              <!-- PDF Attachment indicator -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;background:#fef3c7;border-radiu":10px;border:1px solid #fcd34d;s>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:middle;">
                          <div style="width:40px;height:40px;background:#dc2626;border-radiu":8px;text-align:center;line-height:40px;color:#fff;font-weight:700;font-size:12px;s>PDF</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-size:14px;font-weight:600;color:#1f2937;">${escapeHtml(params.pdfNome)}</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Documento em anexo neste e-mail</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>` : ''}
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">
                <tr>
                  <td style="padding:6px 0;font-size:12.5px;color:#9ca3af;">Condomínio</td>
                  <td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600;text-align:right;">${escapeHtml(params.condominio)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12.5px;color:#9ca3af;">Enviado por</td>
                  <td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600;text-align:right;">${escapeHtml(params.enviadoPor)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12.5px;color:#9ca3af;">Data</td>
                  <td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600;text-align:right;">${escapeHtml(params.data)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:11.5px;color:#9ca3af;line-height:1.6;">
                Este e-mail foi enviado automaticamente pelo sistema <strong>${escapeHtml(app)}</strong>.<br>
                ${escapeHtml(params.condominio)} — Gestão e Manutenção Predial
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Gera o template correto com base no tipo
 */
export function gerarEmailTemplate(params: EmailTemplateParams): string {
  if (params.tipo === 'comunicado') {
    return gerarEmailComunicado(params);
  }
  return gerarEmailAviso(params);
}

/**
 * Gera preview text-only resumido (para a linha de assunto / preview no cliente de e-mail)
 */
export function gerarAssunto(tipo: 'comunicado' | 'aviso', titulo: string, condominio: string): string {
  const prefixo = tipo === 'comunicado' ? '📄 Comunicado' : '⚡ Aviso';
  return `${prefixo}: ${titulo} — ${condominio}`;
}
