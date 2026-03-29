import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getCondominiosScope } from './middleware/rbac.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-unsafe-secret';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim());
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error('CORS não permitido'));
      },
      credentials: true,
    },
    path: '/ws',
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token não fornecido'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (socket as any).userId = decoded.userId;
      (socket as any).userRole = decoded.role;
      (socket as any).userEmail = decoded.email;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;
    const userEmail = (socket as any).userEmail;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Pre-fetch user's allowed condominios for scope validation
    let allowedCondominios: string[] = [];
    try {
      allowedCondominios = await getCondominiosScope({ id: userId, role: userRole, email: userEmail } as any);
    } catch (err) {
      console.error(`[Socket] Erro ao buscar escopos do usuário ${userId}:`, err);
      socket.emit('error', 'Falha ao carregar permissões, por favor reconecte.');
      socket.disconnect(true);
      return;
    }

    socket.on('join-condominio', (condominioId: string) => {
      if (!allowedCondominios.includes(condominioId)) {
        socket.emit('error', 'Sem acesso a este condomínio');
        return;
      }
      socket.join(`cond:${condominioId}`);
    });
    socket.on('disconnect', () => {});
  });

  console.log('[WebSocket] Socket.IO inicializado em /ws');
  return io;
}

export function getIO(): Server | null {
  return io;
}

/** Emit a notification to a specific user */
export function emitToUser(userId: string, event: string, data: any) {
  io?.to(`user:${userId}`).emit(event, data);
}

/** Emit an event to all users in a condominium */
export function emitToCondominio(condominioId: string, event: string, data: any) {
  io?.to(`cond:${condominioId}`).emit(event, data);
}

/** Broadcast to all connected users */
export function broadcast(event: string, data: any) {
  io?.emit(event, data);
}
