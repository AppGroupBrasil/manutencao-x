import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db/database.js';
import { authMiddleware } from './middleware/auth.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3001');

// ── Middlewares globais ──
app.use(compression());
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
    if (allowedOrigins.some(allowed => origin === allowed || origin === allowed.replace('https://', 'https://www.') || origin === allowed.replace('https://www.', 'https://'))) {
      return cb(null, true);
    }
    console.warn(`[CORS] Origem bloqueada: ${origin}`);
    cb(new Error('CORS não permitido'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Rate limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});
app.use('/api', apiLimiter);

// ── Rotas públicas ──
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/portal', authLimiter, portalMoradorRoutes);

// ── Rotas protegidas ──
const protectedRouter = express.Router();
protectedRouter.use(authMiddleware);
protectedRouter.use(scopeMiddleware);

// Metrics tracking (non-blocking, POST/PUT/PATCH/DELETE only)
protectedRouter.use((req: any, _res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.user) {
    const condId = (req as any).condominioIds?.[0] || null;
    const acao = `${req.method} ${req.baseUrl}${req.path}`.slice(0, 100);
    trackMetric(condId, req.user.id, acao);
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
    const client = await pool.connect();
    try {
      const dbResult = await client.query('SELECT 1');
      const uptime = process.uptime();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    } finally {
      client.release();
    }
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
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
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message, err.stack?.split('\n').slice(0, 3).join('\n'));
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
  });
});

// ── Start ──
initSocket(httpServer);
httpServer.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
  iniciarScheduler();
});

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
