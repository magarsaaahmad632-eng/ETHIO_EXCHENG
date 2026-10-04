import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthenticatedRequest } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { lockEscrow, releaseEscrow, refundEscrow, getUserWallet } from '../lib/ledger.js';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'orders');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Create new P2P Order (Enforces mandatory KYC verification)
router.post('/create', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Mandatory KYC Check
    if (req.user.kycStatus !== 'APPROVED' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Mandatory KYC verification required before initiating P2P trades. Please complete identity verification in the KYC tab.',
      });
    }

    const { adId, cryptoAmount, paymentMethod } = req.body;
    const numCrypto = parseFloat(cryptoAmount);

    if (!adId || isNaN(numCrypto) || numCrypto <= 0 || !paymentMethod) {
      return res.status(400).json({ error: 'Invalid order parameters' });
    }

    const ad = await prisma.advertisement.findUnique({
      where: { id: adId },
      include: { user: true },
    });

    if (!ad || !ad.active) {
      return res.status(404).json({ error: 'Advertisement not found or inactive' });
    }

    if (numCrypto < ad.minLimit || numCrypto > ad.maxLimit) {
      return res.status(400).json({
        error: `Order amount must be between ${ad.minLimit} and ${ad.maxLimit} USDT`,
      });
    }

    let buyerId: string;
    let sellerId: string;

    if (ad.type === 'SELL') {
      sellerId = ad.userId;
      buyerId = req.user.id;
    } else {
      sellerId = req.user.id;
      buyerId = ad.userId;
    }

    if (buyerId === sellerId) {
      return res.status(400).json({ error: 'You cannot trade with your own advertisement' });
    }

    // Check seller available wallet balance
    const sellerWallet = await getUserWallet(sellerId);
    if (sellerWallet.availableUsdt < numCrypto) {
      return res.status(400).json({
        error: `Seller has insufficient available USDT balance (${sellerWallet.availableUsdt.toFixed(2)} USDT available)`,
      });
    }

    const fiatAmount = numCrypto * ad.price;
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          advertisementId: ad.id,
          buyerId,
          sellerId,
          cryptoAmount: numCrypto,
          fiatAmount,
          price: ad.price,
          paymentMethod,
          status: 'PENDING_PAYMENT',
          expiresAt,
        },
      });

      return createdOrder;
    });

    // Lock Escrow from seller's wallet
    await lockEscrow(sellerId, numCrypto, order.id);

    return res.json({
      success: true,
      message: 'Order created successfully and crypto locked in escrow',
      order,
    });
  } catch (error: any) {
    console.error('Order creation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// List user orders
router.get('/my', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const orders = await prisma.order.findMany({
      where: {
        OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }],
      },
      include: {
        buyer: { select: { id: true, username: true, firstName: true, telegramId: true } },
        seller: { select: { id: true, username: true, firstName: true, telegramId: true } },
        advertisement: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(orders);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Get single order
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        buyer: { select: { id: true, username: true, firstName: true, telegramId: true, kycStatus: true } },
        seller: { select: { id: true, username: true, firstName: true, telegramId: true, kycStatus: true } },
        advertisement: true,
        dispute: {
          include: {
            messages: {
              include: { sender: { select: { id: true, firstName: true, role: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isParticipant = order.buyerId === req.user.id || order.sellerId === req.user.id || req.user.role === 'ADMIN';
    if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

    return res.json(order);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Mark order as Paid (Buyer action)
router.post(
  '/:id/pay',
  authenticateToken,
  upload.single('proofPhoto'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { paymentRef } = req.body;

      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      if (order.buyerId !== req.user.id) {
        return res.status(403).json({ error: 'Only the buyer can mark the order as paid' });
      }

      if (order.status !== 'PENDING_PAYMENT') {
        return res.status(400).json({ error: `Cannot mark order as paid in status: ${order.status}` });
      }

      const proofPhoto = req.file ? `/uploads/orders/${req.file.filename}` : order.proofPhoto;

      const updated = await prisma.order.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentRef: paymentRef || order.paymentRef,
          proofPhoto: proofPhoto || null,
        },
      });

      return res.json({
        success: true,
        message: 'Order marked as paid. Seller notified to release crypto.',
        order: updated,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Release crypto (Seller action)
router.post('/:id/release', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.sellerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only the seller or admin can release crypto' });
    }

    if (!['PAID', 'DISPUTED'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot release crypto for order in status: ${order.status}` });
    }

    // Atomic Escrow release
    await releaseEscrow(order.sellerId, order.buyerId, order.cryptoAmount, order.id);

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'Crypto released to buyer successfully!',
      order: updated,
    });
  } catch (error: any) {
    console.error('Release error:', error);
    return res.status(500).json({ error: error.message || 'Failed to release crypto' });
  }
});

// Cancel order
router.post('/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isBuyer = order.buyerId === req.user.id;
    const isSeller = order.sellerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'EXPIRED') {
      return res.status(400).json({ error: `Order is already ${order.status}` });
    }

    if (order.status === 'PAID' && !isAdmin) {
      return res.status(400).json({ error: 'Cannot cancel a paid order without admin intervention. Please open a dispute.' });
    }

    // Refund locked escrow back to seller
    await refundEscrow(order.sellerId, order.cryptoAmount, order.id);

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'Order cancelled and locked escrow refunded to seller',
      order: updated,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
