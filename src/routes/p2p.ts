import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { getUserWallet } from '../lib/ledger.js';

const router = Router();

// Get active P2P Advertisements
router.get('/ads', async (req, res) => {
  try {
    const { type, asset } = req.query;

    const whereClause: any = { active: true };
    if (type && typeof type === 'string') {
      whereClause.type = type.toUpperCase();
    }
    if (asset && typeof asset === 'string') {
      whereClause.cryptoAsset = asset.toUpperCase();
    }

    const ads = await prisma.advertisement.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            kycStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(ads);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create new advertisement (Enforces mandatory KYC verification)
router.post('/ads', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Mandatory KYC Check
    if (req.user.kycStatus !== 'APPROVED' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Mandatory KYC verification required before creating advertisements. Please complete identity verification in the KYC tab.',
      });
    }

    const { type, cryptoAsset, fiatCurrency, price, minLimit, maxLimit, paymentMethods, terms } = req.body;

    const numPrice = parseFloat(price);
    const numMin = parseFloat(minLimit);
    const numMax = parseFloat(maxLimit);

    if (!type || !['BUY', 'SELL'].includes(type.toUpperCase())) {
      return res.status(400).json({ error: 'Ad type must be BUY or SELL' });
    }

    if (isNaN(numPrice) || numPrice <= 0 || isNaN(numMin) || numMin <= 0 || isNaN(numMax) || numMax < numMin) {
      return res.status(400).json({ error: 'Invalid price or limit values' });
    }

    let methodsArray: string[] = [];
    if (Array.isArray(paymentMethods)) {
      methodsArray = paymentMethods;
    } else if (typeof paymentMethods === 'string') {
      try {
        methodsArray = JSON.parse(paymentMethods);
      } catch (e) {
        methodsArray = [paymentMethods];
      }
    }

    if (methodsArray.length === 0) {
      return res.status(400).json({ error: 'At least one payment method is required' });
    }

    // For SELL ads, verify user has sufficient available balance
    if (type.toUpperCase() === 'SELL') {
      const wallet = await getUserWallet(req.user.id);
      if (wallet.availableUsdt < numMin) {
        return res.status(400).json({
          error: `Insufficient available balance to create SELL ad. Min order: ${numMin} USDT, Available: ${wallet.availableUsdt.toFixed(2)} USDT`,
        });
      }
    }

    const ad = await prisma.advertisement.create({
      data: {
        userId: req.user.id,
        type: type.toUpperCase(),
        cryptoAsset: (cryptoAsset || 'USDT').toUpperCase(),
        fiatCurrency: (fiatCurrency || 'ETB').toUpperCase(),
        price: numPrice,
        minLimit: numMin,
        maxLimit: numMax,
        paymentMethods: JSON.stringify(methodsArray),
        terms: terms || null,
        active: true,
      },
    });

    return res.json({
      success: true,
      message: 'Advertisement created successfully',
      ad,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Toggle Ad active state
router.patch('/ads/:id/toggle', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const ad = await prisma.advertisement.findUnique({ where: { id } });

    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    if (ad.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.advertisement.update({
      where: { id },
      data: { active: !ad.active },
    });

    return res.json({ success: true, active: updated.active });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
