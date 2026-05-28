import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './db/database.js';
import { authMiddleware, AuthRequest } from './middleware/auth.js';
import { scopeMiddleware } from './middleware/rbac.js';
import { trackMetric } from './middleware/helpers.js';
import authRoutes from './routes/auth.js';
import condominiosRoutes from './routes/condominios.js';
import ordensServicoRoutes from './routes/ordensServico.js';
import checklistsRoutes from './routes/checklists.js';
import escalasRoutes from './routes/escalas.js';
import materiaisRoutes from './routes/materiais.js';
import inspecoesRoutes from './routes/inspecoes.js';
import vistoriasRoutes from './routes/vistorias.js';
import reportesRoutes from './routes/reportes.js';
import tarefasRoutes from './routes/tarefas.js';
import roteirosRoutes from './routes/roteiros.js';
import qrcodesRoutes from './routes/qrcodes.js';
import geoRoutes from './routes/geolocalizacao.js';
import comunicadosRoutes from './routes/comunicados.js';
import moradoresRoutes from './routes/moradores.js';
import vencimentosRoutes from './routes/vencimentos.js';
import quadroRoutes from './routes/quadroAtividades.js';
import usuariosRoutes from './routes/usuarios.js';
import configRoutes from './routes/configuracoes.js';
import permissoesRoutes from './routes/permissoes.js';
import uploadRoutes from './routes/upload.js';
import dashboardRoutes from './routes/dashboard.js';
import relatoriosRoutes from './routes/relatorios.js';
import notificacoesRoutes from './routes/notificacoes.js';
import perfilRoutes from './routes/perfil.js';
import auditRoutes from './routes/audit.js';
import equipamentosRoutes from './routes/equipamentos.js';
import fornecedoresRoutes from './routes/fornecedores.js';
import planosManutencaoRoutes from './routes/planosManutencao.js';
import custosRoutes from './routes/custos.js';
import kpisRoutes from './routes/kpis.js';
import documentosRoutes from './routes/documentos.js';
import portalMoradorRoutes from './routes/portalMorador.js';
import provisioningRoutes from './routes/provisioning.js';
import solicitacoesRoutes from './routes/solicitacoes.js';
import slaRoutes from './routes/sla.js';
import pdfRoutes from './routes/pdf.js';
import whatsappRoutes from './routes/whatsapp.js';
import sindicoRoutes from './routes/sindico.js';
import pushRoutes from './routes/push.js';
import calendarioRoutes from './routes/calendario.js';
import exportRoutes from './routes/export.js';
import pontoRoutes from './routes/ponto.js';
import contratosRoutes from './routes/contratos.js';
import orcamentosRoutes from './routes/orcamentos.js';
import { iniciarScheduler } from './scheduler.js';
import { initSocket } from './socket.js';
import { runMigrations } from './db/migrate.js';
import { initSentry } from './services/sentry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Traefik fica na frente -> confiar no primeiro proxy para X-Forwarded-For / IP real
app.set('trust proxy', 1);
const httpServer = createServer(app);
const PORT = Number.parseInt(process.env.PORT || '3001');
const isProduction = process.env.NODE_ENV === 'production';
const rateLimitEnabled =
  process.env.RATE_LIMIT_ENABLED === 'true' ||
  (process.env.RATE_LIMIT_ENABLED !== 'false' && isProduction);

const REQUIRED_ENV_VARS = ['DB_PASSWORD', 'JWT_SECRET', 'FRONTEND_URL', 'CORS_ORIGIN'] as const;

function validateCriticalEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`[ENV] ❌ Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function expandAllowedOrigin(origin: string) {
  const variants = new Set([origin]);

  if (origin.includes('localhost')) {
    variants.add(origin.replace('localhost', '127.0.0.1'));
  }

  if (origin.includes('127.0.0.1')) {
    variants.add(origin.replace('127.0.0.1', 'localhost'));
  }

  variants.add(origin.replace('https://', 'https://www.'));
  variants.add(origin.replace('https://www.', 'https://'));

  return Array.from(variants);
}

function isAllowedDevOrigin(origin: string) {
  if (isProduction) return false;

  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

async function checkDatabaseConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

validateCriticalEnvironment();

// ── Middlewares globais ──
app.use(compression());
app.use((req, res, next) => {
  const id = (req.headers['x-request-id'] as string) || Math.random().toString(36).slice(2, 10);
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
});
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sem origin (mobile apps, curl, proxies internos)
    if (!origin) return cb(null, true);
    // Checar lista de origens permitidas
    if (isAllowedDevOrigin(origin)) {
      return cb(null, true);
    }
    if (allowedOrigins.some(allowed => expandAllowedOrigin(allowed).includes(origin))) {
      return cb(null, true);
    }
    console.warn(`[CORS] Origem bloqueada: ${origin}`);
    cb(new Error('CORS não permitido'));
  },
  credentials: true,
}));
// JSON parser: limites pequenos para auth, padrão moderado para o resto. Upload usa multipart e ignora isso.
app.use('/api/auth', express.json({ limit: '64kb' }));
app.use('/api/portal/login', express.json({ limit: '64kb' }));
app.use('/api/portal/primeiro-acesso', express.json({ limit: '64kb' }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Rate limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: rateLimitEnabled ? 300 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !rateLimitEnabled,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
const buildAuthLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: rateLimitEnabled ? 20 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !rateLimitEnabled,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});
const authLimiter = buildAuthLimiter();
const portalLimiter = buildAuthLimiter();
app.use('/api', apiLimiter);

// ── Rotas públicas ──
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/portal', portalLimiter, portalMoradorRoutes);
app.use('/api/provisioning', provisioningRoutes);

// ── Rotas protegidas ──
const protectedRouter = express.Router();
protectedRouter.use(authMiddleware);
protectedRouter.use(scopeMiddleware);

// Metrics tracking (non-blocking, POST/PUT/PATCH/DELETE only)
protectedRouter.use((req, _res, next) => {
  const r = req as AuthRequest;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && r.user) {
    const condId = req.condominioIds?.[0] || null;
    const acao = `${req.method} ${req.baseUrl}${req.path}`.slice(0, 100);
    trackMetric(condId, r.user.id, acao);
  }
  next();
});

protectedRouter.use('/condominios', condominiosRoutes);
protectedRouter.use('/ordens-servico', ordensServicoRoutes);
protectedRouter.use('/checklists', checklistsRoutes);
protectedRouter.use('/escalas', escalasRoutes);
protectedRouter.use('/materiais', materiaisRoutes);
protectedRouter.use('/inspecoes', inspecoesRoutes);
protectedRouter.use('/vistorias', vistoriasRoutes);
protectedRouter.use('/reportes', reportesRoutes);
protectedRouter.use('/tarefas', tarefasRoutes);
protectedRouter.use('/roteiros', roteirosRoutes);
protectedRouter.use('/qrcodes', qrcodesRoutes);
protectedRouter.use('/geolocalizacao', geoRoutes);
protectedRouter.use('/comunicados', comunicadosRoutes);
protectedRouter.use('/moradores', moradoresRoutes);
protectedRouter.use('/vencimentos', vencimentosRoutes);
protectedRouter.use('/quadro-atividades', quadroRoutes);
protectedRouter.use('/usuarios', usuariosRoutes);
protectedRouter.use('/configuracoes', configRoutes);
protectedRouter.use('/permissoes', permissoesRoutes);
protectedRouter.use('/upload', uploadRoutes);
protectedRouter.use('/dashboard', dashboardRoutes);
protectedRouter.use('/relatorios', relatoriosRoutes);
protectedRouter.use('/notificacoes', notificacoesRoutes);
protectedRouter.use('/perfil', perfilRoutes);
protectedRouter.use('/audit', auditRoutes);
protectedRouter.use('/equipamentos', equipamentosRoutes);
protectedRouter.use('/fornecedores', fornecedoresRoutes);
protectedRouter.use('/planos-manutencao', planosManutencaoRoutes);
protectedRouter.use('/custos', custosRoutes);
protectedRouter.use('/kpis', kpisRoutes);
protectedRouter.use('/documentos', documentosRoutes);
protectedRouter.use('/solicitacoes', solicitacoesRoutes);
protectedRouter.use('/sla', slaRoutes);
protectedRouter.use('/pdf', pdfRoutes);
protectedRouter.use('/whatsapp', whatsappRoutes);
protectedRouter.use('/sindico', sindicoRoutes);
protectedRouter.use('/push', pushRoutes);
protectedRouter.use('/calendario', calendarioRoutes);
protectedRouter.use('/export', exportRoutes);
protectedRouter.use('/ponto', pontoRoutes);
protectedRouter.use('/contratos', contratosRoutes);
protectedRouter.use('/orcamentos', orcamentosRoutes);

// ── Health check (before auth middleware) ──
app.get('/api/health', async (_req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({
      status: 'ok',
      service: 'manutencao-api',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.get('/api/ready', async (_req, res) => {
  const missingEnv = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());

  try {
    await checkDatabaseConnection();
  } catch {
    res.status(503).json({
      status: 'not_ready',
      checks: {
        database: 'down',
        env: missingEnv.length === 0 ? 'ok' : 'missing',
      },
      missingEnv,
    });
    return;
  }

  if (missingEnv.length > 0) {
    res.status(503).json({
      status: 'not_ready',
      checks: {
        database: 'ok',
        env: 'missing',
      },
      missingEnv,
    });
    return;
  }

  res.json({
    status: 'ready',
    checks: {
      database: 'ok',
      env: 'ok',
    },
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', protectedRouter);

// ── Global error handler (MUST be last middleware) ──
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // CORS error — return 403 with message
  if (err.message === 'CORS não permitido') {
    res.status(403).json({ error: 'Origem não autorizada' });
    return;
  }
  // PostgreSQL FK violation → friendly 409
  if (err.code === '23503') {
    res.status(409).json({ error: 'Não é possível realizar esta operação pois existem registros vinculados' });
    return;
  }
  // PostgreSQL unique violation → friendly 409
  if (err.code === '23505') {
    res.status(409).json({ error: 'Registro duplicado. Já existe um registro com estes dados' });
    return;
  }
  // PostgreSQL connection error
  if (err.code === 'ECONNREFUSED' || err.code === '57P01') {
    console.error('[DB ERROR] Conexão com banco perdida:', err.message);
    res.status(503).json({ error: 'Servidor temporariamente indisponível. Tente novamente.' });
    return;
  }
  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Dados inválidos na requisição' });
    return;
  }
  const reqId = req.requestId;
  if (isProduction) {
    console.error(`[ERROR] [${reqId}] ${req.method} ${req.path}: ${err.message}`);
  } else {
    console.error(`[ERROR] [${reqId}] ${req.method} ${req.path}:`, err.message, err.stack?.split('\n').slice(0, 5).join('\n'));
  }
  const status = err.status || 500;
  res.status(status).json({
    error: isProduction ? 'Erro interno do servidor' : err.message,
    requestId: reqId,
  });
});

// ── Start ──
async function start() {
  try {
    await checkDatabaseConnection();
    console.log('[DB] Conexão verificada.');
  } catch (err: any) {
    console.error('[DB] ❌ Falha na conexão inicial:', err.message);
    process.exit(1);
  }
  try {
    await runMigrations();
  } catch (err: any) {
    console.error('[MIGRATE] ❌ Erro nas migrações, encerrando:', err.message);
    process.exit(1);
  }
  await initSentry(app);
  initSocket(httpServer);
  httpServer.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
    iniciarScheduler();
  });
}
start();

// ── Graceful shutdown ──
const shutdown = async (signal: string) => {
  console.log(`[SHUTDOWN] ${signal} recebido, encerrando...`);
  httpServer.close(async () => {
    try {
      await pool.end();
      console.log('[SHUTDOWN] Pool de conexões fechado');
      process.exit(0);
    } catch (err) {
      console.error('[SHUTDOWN] Erro ao fechar pool:', err);
      process.exit(1);
    }
  });
  setTimeout(() => { console.error('[SHUTDOWN] Timeout - forçando saída'); process.exit(1); }, 30000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
