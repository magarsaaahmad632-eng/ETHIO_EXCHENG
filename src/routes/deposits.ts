import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthenticatedRequest } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'deposits');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `deposit-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// List active deposit payment accounts
router.get('/accounts', async (_req, res) => {
  try {
    const accounts = await prisma.depositAccount.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(accounts);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create deposit request with immutable payment account snapshot
router.post(
  '/request',
  authenticateToken,
  upload.single('proofPhoto'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { asset, providerName, amount, depositAccountId, refNumber } = req.body;
      const numAmount = parseFloat(amount);

      if (!asset || !providerName || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit request parameters' });
      }

      let accountSnapshot: string | null = null;
      if (depositAccountId) {
        const account = await prisma.depositAccount.findUnique({ where: { id: depositAccountId } });
        if (account) {
          accountSnapshot = JSON.stringify({
            id: account.id,
            asset: account.asset,
            providerName: account.providerName,
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            instructions: account.instructions,
            snapshotTimestamp: new Date().toISOString(),
          });
        }
      }

      const proofPhoto = req.file ? `/uploads/deposits/${req.file.filename}` : undefined;

      const depositRequest = await prisma.depositRequest.create({
        data: {
          userId: req.user.id,
          asset: asset.toUpperCase(),
          providerName,
          amount: numAmount,
          depositAccountId: depositAccountId || null,
          paymentAccountSnapshot: accountSnapshot,
          refNumber: refNumber || null,
          proofPhoto,
          status: 'PENDING',
        },
      });

      return res.json({
        success: true,
        message: 'Deposit request created and pending admin verification',
        depositRequest,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// User deposit history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const deposits = await prisma.depositRequest.findMany({
      where: { userId: req.user.id },
      include: { depositAccount: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(deposits);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
