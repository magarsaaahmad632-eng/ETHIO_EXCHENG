import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../lib/auth.js';
import { getUserWallet } from '../lib/ledger.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Balance endpoint
router.get('/balance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const wallet = await getUserWallet(req.user.id);
    return res.json(wallet);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// History endpoint
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const transactions = await prisma.ledgerTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json(transactions);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Withdrawal request
router.post('/withdraw', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { amount, destinationAddress } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    if (!destinationAddress || destinationAddress.trim().length < 10) {
      return res.status(400).json({ error: 'Invalid USDT wallet destination address' });
    }

    const wallet = await getUserWallet(req.user.id);
    if (wallet.availableUsdt < numAmount) {
      return res.status(400).json({
        error: `Insufficient available funds. Available: ${wallet.availableUsdt.toFixed(2)} USDT, Requested: ${numAmount.toFixed(2)} USDT`,
      });
    }

    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        userId: req.user.id,
        asset: 'USDT',
        amount: numAmount,
        destinationAddress: destinationAddress.trim(),
        status: 'PENDING',
      },
    });

    return res.json({
      success: true,
      message: 'Withdrawal request submitted for processing',
      withdrawal,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
