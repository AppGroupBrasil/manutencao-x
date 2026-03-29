import nodemailer from 'nodemailer';

// Configuração do transporte de e-mail
// Em produção, usar SMTP real (SendGrid, AWS SES, etc.)
// Em desenvolvimento, cai no console.log se SMTP_HOST não estiver configurado
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Manutenção X <noreply@manutencaox.com.br>';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  console.log(`[Email] SMTP configurado: ${SMTP_HOST}:${SMTP_PORT}`);
} else if (IS_PRODUCTION) {
  console.warn('[Email] SMTP_HOST não configurado em produção. O envio de e-mails ficará desabilitado.');
} else {
  console.log('[Email] SMTP_HOST não configurado. E-mails serão logados no console.');
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

  if (!transporter) {
    if (IS_PRODUCTION) {
      console.warn(`[Email] Envio ignorado porque SMTP não está configurado. Destinatário: ${to}`);
      return false;
    }

    console.log(`[Email][DEV] Para: ${to}`);
    console.log(`[Email][DEV] Assunto: ${options.subject}`);
    console.log(`[Email][DEV] Corpo: ${options.text || options.html.slice(0, 200)}...`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    console.log(`[Email] Enviado para ${to}: ${options.subject}`);
    return true;
  } catch (err: any) {
    console.error(`[Email] Erro ao enviar para ${to}:`, err.message);
    return false;
  }
}

// ── Templates de e-mail ──

export function emailResetSenha(nome: string, token: string, resetUrl: string): EmailOptions {
  const link = `${resetUrl}?token=${token}`;
  return {
    to: '',
    subject: 'Redefinição de Senha - Manutenção X',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af;">Redefinição de Senha</h2>
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p>Clique no botão abaixo para criar uma nova senha:</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
          Redefinir Senha
        </a>
        <p style="font-size:12px;color:#6b7280;">Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>
      </div>
    `,
    text: `Olá ${nome}, acesse o link para redefinir sua senha: ${link} (expira em 1 hora)`,
  };
}

export function emailVencimentoAlerta(
  docTitulo: string,
  diasRestantes: number,
  condominioNome: string,
  dataVencimento: string
): EmailOptions {
  return {
    to: '',
    subject: `⚠️ Vencimento em ${diasRestantes} dias: ${docTitulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #d97706;">Alerta de Vencimento</h2>
        <p>O documento <strong>${docTitulo}</strong> do condomínio <strong>${condominioNome}</strong>
           vence em <strong>${diasRestantes} dia(s)</strong> (${dataVencimento}).</p>
        <p>Providencie a renovação o mais breve possível.</p>
      </div>
    `,
    text: `Alerta: ${docTitulo} (${condominioNome}) vence em ${diasRestantes} dias (${dataVencimento}).`,
  };
}

export function emailOSCriada(
  protocolo: string,
  titulo: string,
  condominioNome: string,
  prioridade: string
): EmailOptions {
  return {
    to: '',
    subject: `Nova OS: ${protocolo} - ${titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Nova Ordem de Serviço</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;">Protocolo</td><td style="padding:6px 0;font-weight:600;">${protocolo}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Título</td><td style="padding:6px 0;">${titulo}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Condomínio</td><td style="padding:6px 0;">${condominioNome}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Prioridade</td><td style="padding:6px 0;text-transform:capitalize;">${prioridade}</td></tr>
        </table>
      </div>
    `,
    text: `Nova OS ${protocolo}: ${titulo} (${condominioNome}) - Prioridade: ${prioridade}`,
  };
}
