import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Open a dispute
router.post('/open', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
      return res.status(400).json({ error: 'Order ID and dispute reason are required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { dispute: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isParticipant = order.buyerId === req.user.id || order.sellerId === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

    if (order.dispute) {
      return res.status(400).json({ error: 'A dispute is already open for this order' });
    }

    // Create dispute & update order status
    const dispute = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'DISPUTED' },
      });

      const newDispute = await tx.dispute.create({
        data: {
          orderId,
          openedById: req.user!.id,
          reason,
          status: 'OPEN',
        },
      });

      await tx.disputeMessage.create({
        data: {
          disputeId: newDispute.id,
          senderId: req.user!.id,
          senderRole: order.buyerId === req.user!.id ? 'BUYER' : 'SELLER',
          message: `Dispute opened: ${reason}`,
        },
      });

      return newDispute;
    });

    return res.json({
      success: true,
      message: 'Dispute opened. Admin notified for review.',
      dispute,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Get dispute details
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          include: {
            buyer: { select: { id: true, firstName: true, username: true } },
            seller: { select: { id: true, firstName: true, username: true } },
          },
        },
        openedBy: { select: { id: true, firstName: true, username: true } },
        messages: {
          include: { sender: { select: { id: true, firstName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    const isParticipant =
      dispute.order.buyerId === req.user.id ||
      dispute.order.sellerId === req.user.id ||
      req.user.role === 'ADMIN';

    if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

    return res.json(dispute);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Post dispute message
router.post('/:id/message', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { message, attachment } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    let senderRole = 'USER';
    if (req.user.role === 'ADMIN') {
      senderRole = 'ADMIN';
    } else if (dispute.order.buyerId === req.user.id) {
      senderRole = 'BUYER';
    } else if (dispute.order.sellerId === req.user.id) {
      senderRole = 'SELLER';
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chatMsg = await prisma.disputeMessage.create({
      data: {
        disputeId: id,
        senderId: req.user.id,
        senderRole,
        message,
        attachment: attachment || null,
      },
    });

    return res.json({ success: true, message: chatMsg });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
