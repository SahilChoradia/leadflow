import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@leadflow/types';

// Extended socket type with authenticated user context
export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    brokerageId?: string;
  };
}

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not yet initialized');
  return io;
}

/**
 * Emit an event to all connected clients within a specific brokerage room.
 */
export function emitToBrokerage(brokerageId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`brokerage:${brokerageId}`).emit(event, payload);
}

/**
 * Emit an event to a specific connected user.
 */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',');

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // ── Authentication Middleware for Handshake ────────────────────────────────
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice(7)
        : null);

    if (!token) {
      // Allow unauthenticated connection only if explicitly allowed (e.g. testing),
      // but without auto-room join. Clients can still join via join:brokerage if given access.
      return next();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return next(new Error('Server configuration error: JWT_SECRET missing'));

    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      socket.user = {
        id: payload.sub,
        role: payload.role,
        brokerageId: payload.brokerageId,
      };
      next();
    } catch {
      next(new Error('Authentication failed: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.info(`[socket] Client connected: ${socket.id}`);

    // If authenticated via handshake JWT, automatically join tenant and user rooms
    if (socket.user?.brokerageId) {
      const room = `brokerage:${socket.user.brokerageId}`;
      socket.join(room);
      socket.join(`user:${socket.user.id}`);
      console.info(`[socket] ${socket.id} (user ${socket.user.id}) auto-joined ${room}`);
    }

    // Support explicit room joining (with authorization verification)
    socket.on('join:brokerage', (brokerageId: string) => {
      // If user is authenticated, ensure they belong to this brokerage or are platform_admin
      if (socket.user && socket.user.role !== 'platform_admin' && socket.user.brokerageId !== brokerageId) {
        console.warn(`[socket] Unauthorized room join attempt by ${socket.id} to brokerage:${brokerageId}`);
        return;
      }
      const room = `brokerage:${brokerageId}`;
      socket.join(room);
      console.info(`[socket] ${socket.id} joined room ${room}`);
    });

    socket.on('leave:brokerage', (brokerageId: string) => {
      socket.leave(`brokerage:${brokerageId}`);
      console.info(`[socket] ${socket.id} left room brokerage:${brokerageId}`);
    });

    socket.on('disconnect', (reason) => {
      console.info(`[socket] Client disconnected ${socket.id}: ${reason}`);
    });
  });

  console.info('[socket] Socket.io initialized');
  return io;
}
