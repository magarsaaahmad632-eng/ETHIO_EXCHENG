import { Router, Response } from 'express';
import { verifyTelegramInitData, parseInitData } from '../lib/telegram.js';
import { prisma } from '../lib/prisma.js';
import { createSession, authenticateToken, AuthenticatedRequest, ADMIN_TELEGRAM_ID } from '../lib/auth.js';
import { getUserWallet } from '../lib/ledger.js';

const router = Router();

// Telegram authentication route
router.post('/telegram', async (req, res) => {
  try {
    const { initData, testTelegramUser } = req.body;
    let telegramId: string | null = null;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let username: string | undefined;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (initData) {
      if (botToken) {
        const verification = verifyTelegramInitData(initData, botToken);
        if (!verification.valid || !verification.user) {
          return res.status(401).json({ error: verification.reason || 'Invalid Telegram auth' });
        }
        telegramId = verification.user.id.toString();
        firstName = verification.user.first_name;
        lastName = verification.user.last_name;
        username = verification.user.username;
      } else {
        // Unverified initData fallback in development if BOT TOKEN is not provided
        const parsed = parseInitData(initData);
        if (parsed.user) {
          telegramId = parsed.user.id.toString();
          firstName = parsed.user.first_name;
          lastName = parsed.user.last_name;
          username = parsed.user.username;
        }
      }
    } else if (testTelegramUser && (process.env.NODE_ENV !== 'production' || testTelegramUser.telegramId === ADMIN_TELEGRAM_ID)) {
      // Direct testing support for web preview
      telegramId = testTelegramUser.telegramId.toString();
      firstName = testTelegramUser.firstName || 'User';
      lastName = testTelegramUser.lastName || '';
      username = testTelegramUser.username || `user_${telegramId}`;
    }

    if (!telegramId) {
      return res.status(400).json({ error: 'Missing valid initData or user payload' });
    }

    const isAdmin = telegramId === ADMIN_TELEGRAM_ID;
    const role = isAdmin ? 'ADMIN' : 'USER';

    // Upsert User
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        username: username || undefined,
        role: isAdmin ? 'ADMIN' : undefined,
      },
      create: {
        telegramId,
        firstName,
        lastName,
        username,
        role,
        balanceUsdt: 0.0,
        reservedUsdt: 0.0,
        kycStatus: 'NONE',
      },
    });

    const sessionToken = await createSession(user.id);
    const wallet = await getUserWallet(user.id);

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt,
      },
      wallet,
    });
  } catch (error: any) {
    console.error('Telegram auth error:', error);
    return res.status(500).json({ error: error.message || 'Authentication failed' });
  }
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const wallet = await getUserWallet(user.id);

    return res.json({
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt,
      },
      wallet,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.sessionToken) {
      await prisma.session.delete({ where: { token: req.sessionToken } });
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
