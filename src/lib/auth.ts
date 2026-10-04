import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from './prisma.js';

export const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '7891606253';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role: string;
    kycStatus: string;
  };
  sessionToken?: string;
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { token } });
      return res.status(401).json({ error: 'Unauthorized: Session expired' });
    }

    req.user = {
      id: session.user.id,
      telegramId: session.user.telegramId,
      username: session.user.username,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
      kycStatus: session.user.kycStatus,
    };
    req.sessionToken = token;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const isAdmin = req.user.role === 'ADMIN' || req.user.telegramId === ADMIN_TELEGRAM_ID;

  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
}
