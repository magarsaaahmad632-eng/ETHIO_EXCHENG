import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { processDepositApproval, releaseEscrow, refundEscrow } from '../lib/ledger.js';
import { logAudit } from '../lib/audit.js';
import { getAllSettings, setSetting, getNumericSetting } from '../lib/settings.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// 1. TODAY RATE ENDPOINTS
router.get('/today-rate', async (_req, res) => {
  try {
    const currentRate = await getNumericSetting('exchange_rate_etb_usdt', 135.5);
    const lastHistory = await prisma.todayRateHistory.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const history = await prisma.todayRateHistory.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return res.json({
      currentRate,
      previousRate: lastHistory ? lastHistory.previousRate : currentRate,
      lastUpdated: lastHistory ? lastHistory.updatedAt : new Date().toISOString(),
      updatedBy: lastHistory ? lastHistory.updatedBy : 'System',
      history,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/today-rate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rate } = req.body;
    const newRate = parseFloat(rate);

    if (isNaN(newRate) || newRate <= 0) {
      return res.status(400).json({ error: 'Rate must be a positive number' });
    }

    const currentRate = await getNumericSetting('exchange_rate_etb_usdt', 135.5);

    // Save in Setting
    await setSetting('exchange_rate_etb_usdt', newRate.toString());

    // Record TodayRateHistory
    const rateLog = await prisma.todayRateHistory.create({
      data: {
        rate: newRate,
        previousRate: currentRate,
        updatedBy: req.user!.telegramId,
      },
    });

    await logAudit(req.user!.id, 'UPDATE_TODAY_RATE', rateLog.id, {
      previousRate: currentRate,
      newRate,
      updatedBy: req.user!.telegramId,
    });

    return res.json({
      success: true,
      message: `Today rate updated to 1 USDT = ${newRate} ETB`,
      currentRate: newRate,
      previousRate: currentRate,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 2. ADMIN P2P ORDERS & FILTERED VIEWS
router.get('/p2p-orders', async (req, res) => {
  try {
    const { status } = req.query;

    const whereClause: any = {};
    if (status && typeof status === 'string' && status.toUpperCase() !== 'ALL') {
      const s = status.toUpperCase();
      if (s === 'APPROVED' || s === 'COMPLETED') {
        whereClause.status = 'COMPLETED';
      } else if (s === 'PENDING') {
        whereClause.status = { in: ['CREATED', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'RELEASE_PENDING'] };
      } else {
        whereClause.status = s;
      }
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        buyer: { select: { id: true, telegramId: true, username: true, firstName: true } },
        seller: { select: { id: true, telegramId: true, username: true, firstName: true } },
        advertisement: true,
        dispute: true,
        events: {
          include: { user: { select: { firstName: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(orders);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. P2P APPROVED PAGE VIEW
router.get('/p2p-orders/approved', async (_req, res) => {
  try {
    const approvedOrders = await prisma.order.findMany({
      where: { status: 'COMPLETED' },
      include: {
        buyer: { select: { id: true, telegramId: true, username: true, firstName: true } },
        seller: { select: { id: true, telegramId: true, username: true, firstName: true } },
        advertisement: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    return res.json(approvedOrders);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. P2P REJECTED PAGE VIEW
router.get('/p2p-orders/rejected', async (_req, res) => {
  try {
    const rejectedOrders = await prisma.order.findMany({
      where: { status: 'REJECTED' },
      include: {
        buyer: { select: { id: true, telegramId: true, username: true, firstName: true } },
        seller: { select: { id: true, telegramId: true, username: true, firstName: true } },
        advertisement: true,
      },
      orderBy: { rejectedAt: 'desc' },
    });

    return res.json(rejectedOrders);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. ADMIN P2P ACTIONS: APPROVE / SETTLE
router.post('/p2p-orders/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Order is already approved and completed' });
    }

    if (order.status === 'REJECTED' || order.status === 'CANCELLED') {
      return res.status(400).json({ error: `Cannot approve order in status: ${order.status}` });
    }

    // Atomic Escrow release: Transfer locked funds to buyer available balance
    await releaseEscrow(order.sellerId, order.buyerId, order.cryptoAmount, order.id);

    const updated = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          fromState: order.status,
          toState: 'COMPLETED',
          triggeredById: req.user!.id,
          note: 'Approved and settled by admin',
        },
      });

      return ord;
    });

    await logAudit(req.user!.id, 'APPROVE_P2P_ORDER', id, {
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      cryptoAmount: order.cryptoAmount,
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: order.buyerId,
          title: 'P2P Order Approved',
          message: `Your P2P order #${order.id.substring(0, 8)} of ${order.cryptoAmount} USDT has been completed and credited to your wallet!`,
          type: 'ORDER',
        },
        {
          userId: order.sellerId,
          title: 'P2P Order Completed',
          message: `Escrow for order #${order.id.substring(0, 8)} of ${order.cryptoAmount} USDT released to buyer.`,
          type: 'ORDER',
        },
      ],
    });

    return res.json({ success: true, message: 'Order approved and completed', order: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. ADMIN P2P ACTIONS: REJECT
router.post('/p2p-orders/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'REJECTED') {
      return res.status(400).json({ error: 'Order is already rejected' });
    }

    if (order.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot reject an already completed order' });
    }

    // Unlock reserved escrow back to seller
    await refundEscrow(order.sellerId, order.cryptoAmount, order.id);

    const updated = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedBy: req.user!.telegramId,
          rejectedAt: new Date(),
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          fromState: order.status,
          toState: 'REJECTED',
          triggeredById: req.user!.id,
          note: `Rejected by admin: ${reason}`,
        },
      });

      return ord;
    });

    await logAudit(req.user!.id, 'REJECT_P2P_ORDER', id, {
      reason,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: order.buyerId,
          title: 'P2P Order Rejected',
          message: `Your P2P order #${order.id.substring(0, 8)} was rejected: ${reason}`,
          type: 'ORDER',
        },
        {
          userId: order.sellerId,
          title: 'P2P Order Rejected',
          message: `P2P order #${order.id.substring(0, 8)} rejected by admin. Escrow refunded to your available balance.`,
          type: 'ORDER',
        },
      ],
    });

    return res.json({ success: true, message: 'Order rejected', order: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 6. KYC ORDERS PAGE ENDPOINT
router.get('/kyc-orders', async (req, res) => {
  try {
    const { status } = req.query;
    const whereClause: any = {};
    if (status && typeof status === 'string' && status.toUpperCase() !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }

    const submissions = await prisma.kycSubmission.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, telegramId: true, username: true, firstName: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return res.json(submissions);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 7. DEPOSIT ORDERS PAGE ENDPOINT
router.get('/deposit-orders', async (req, res) => {
  try {
    const { status } = req.query;
    const whereClause: any = {};
    if (status && typeof status === 'string' && status.toUpperCase() !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }

    const deposits = await prisma.depositRequest.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, telegramId: true, username: true, firstName: true } },
        depositAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(deposits);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 8. WITHDRAWAL ORDERS PAGE ENDPOINT
router.get('/withdrawal-orders', async (req, res) => {
  try {
    const { status } = req.query;
    const whereClause: any = {};
    if (status && typeof status === 'string' && status.toUpperCase() !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, telegramId: true, username: true, firstName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(withdrawals);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// STATS OVERVIEW
router.get('/stats', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const pendingKyc = await prisma.kycSubmission.count({ where: { status: 'PENDING' } });
    const pendingDeposits = await prisma.depositRequest.count({ where: { status: 'PENDING' } });
    const activeAds = await prisma.advertisement.count({ where: { active: true } });
    const openDisputes = await prisma.dispute.count({ where: { status: 'OPEN' } });

    const walletSums = await prisma.user.aggregate({
      _sum: {
        balanceUsdt: true,
        reservedUsdt: true,
        balanceEtb: true,
        reservedEtb: true,
      },
    });

    return res.json({
      totalUsers,
      pendingKyc,
      pendingDeposits,
      activeAds,
      openDisputes,
      totalBalanceUsdt: walletSums._sum.balanceUsdt || 0,
      totalReservedUsdt: walletSums._sum.reservedUsdt || 0,
      totalBalanceEtb: walletSums._sum.balanceEtb || 0,
      totalReservedEtb: walletSums._sum.reservedEtb || 0,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// SETTINGS MANAGEMENT
router.get('/settings', async (_req, res) => {
  try {
    const settings = await getAllSettings();
    return res.json(settings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { p2p_fee_rate, deposit_fee_rate, exchange_rate_etb_usdt, min_order_usdt, max_order_usdt, maintenance_mode } = req.body;

    if (p2p_fee_rate !== undefined) await setSetting('p2p_fee_rate', p2p_fee_rate.toString());
    if (deposit_fee_rate !== undefined) await setSetting('deposit_fee_rate', deposit_fee_rate.toString());
    if (exchange_rate_etb_usdt !== undefined) await setSetting('exchange_rate_etb_usdt', exchange_rate_etb_usdt.toString());
    if (min_order_usdt !== undefined) await setSetting('min_order_usdt', min_order_usdt.toString());
    if (max_order_usdt !== undefined) await setSetting('max_order_usdt', max_order_usdt.toString());
    if (maintenance_mode !== undefined) await setSetting('maintenance_mode', maintenance_mode.toString());

    await logAudit(req.user!.id, 'UPDATE_SETTINGS', null, req.body);

    const updated = await getAllSettings();
    return res.json({ success: true, settings: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// USER BAN / UNBAN
router.post('/users/:id/ban', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    await prisma.user.update({
      where: { id },
      data: { accountStatus: 'BANNED' },
    });

    await logAudit(req.user!.id, 'BAN_USER', id, { telegramId: targetUser.telegramId, reason });

    return res.json({ success: true, message: `User ${targetUser.telegramId} banned` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/users/:id/unban', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    await prisma.user.update({
      where: { id },
      data: { accountStatus: 'ACTIVE' },
    });

    await logAudit(req.user!.id, 'UNBAN_USER', id, { telegramId: targetUser.telegramId });

    return res.json({ success: true, message: `User ${targetUser.telegramId} unbanned` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// KYC SUBMISSIONS & REVIEW
router.get('/kyc', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const submissions = await prisma.kycSubmission.findMany({
      include: {
        user: { select: { id: true, telegramId: true, username: true, firstName: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return res.json(submissions);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/kyc/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, rejectReason } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
    }

    if (action === 'REJECT' && (!rejectReason || rejectReason.trim() === '')) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const submission = await prisma.kycSubmission.findUnique({ where: { id } });
    if (!submission) return res.status(404).json({ error: 'KYC submission not found' });

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await prisma.$transaction([
      prisma.kycSubmission.update({
        where: { id },
        data: {
          status: newStatus,
          rejectReason: action === 'REJECT' ? rejectReason : null,
          reviewedAt: new Date(),
          reviewedBy: req.user!.telegramId,
        },
      }),
      prisma.user.update({
        where: { id: submission.userId },
        data: { kycStatus: newStatus },
      }),
      prisma.notification.create({
        data: {
          userId: submission.userId,
          title: `KYC Verification ${newStatus}`,
          message:
            action === 'APPROVE'
              ? 'Your identity verification has been approved!'
              : `Your KYC was rejected: ${rejectReason || 'Invalid documents'}`,
          type: 'KYC',
        },
      }),
    ]);

    await logAudit(req.user!.id, `KYC_${action}`, submission.userId, { submissionId: id, rejectReason });

    return res.json({ success: true, status: newStatus });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PAYMENT ACCOUNTS
router.get('/deposit-accounts', async (_req, res) => {
  try {
    const accounts = await prisma.depositAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(accounts);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/deposit-accounts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { asset, providerName, accountNumber, accountName, instructions, minLimit, maxLimit } = req.body;

    if (!asset || !providerName || !accountNumber || !accountName) {
      return res.status(400).json({ error: 'Missing required account fields' });
    }

    const account = await prisma.depositAccount.create({
      data: {
        asset: asset.toUpperCase(),
        providerName,
        accountNumber,
        accountName,
        instructions: instructions || null,
        minLimit: parseFloat(minLimit) || 1.0,
        maxLimit: parseFloat(maxLimit) || 100000.0,
        active: true,
      },
    });

    await logAudit(req.user!.id, 'CREATE_DEPOSIT_ACCOUNT', account.id, { providerName, accountNumber });

    return res.json({ success: true, account });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/deposit-accounts/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const account = await prisma.depositAccount.findUnique({ where: { id } });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const updated = await prisma.depositAccount.update({
      where: { id },
      data: { active: !account.active },
    });

    await logAudit(req.user!.id, 'TOGGLE_DEPOSIT_ACCOUNT', id, { active: updated.active });

    return res.json({ success: true, active: updated.active });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DEPOSIT REQUESTS
router.get('/deposits', async (_req, res) => {
  try {
    const deposits = await prisma.depositRequest.findMany({
      include: {
        user: { select: { id: true, telegramId: true, username: true, firstName: true } },
        depositAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(deposits);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/deposits/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, rejectReason } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
    }

    if (action === 'REJECT' && (!rejectReason || rejectReason.trim() === '')) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const deposit = await prisma.depositRequest.findUnique({ where: { id } });
    if (!deposit) return res.status(404).json({ error: 'Deposit request not found' });

    if (deposit.status !== 'PENDING') {
      return res.status(400).json({ error: `Deposit is already ${deposit.status}` });
    }

    if (action === 'APPROVE') {
      const asset = deposit.asset === 'ETB' ? 'ETB' : 'USDT';
      await processDepositApproval(deposit.userId, deposit.amount, deposit.id, asset);

      await prisma.depositRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          processedBy: req.user!.telegramId,
        },
      });

      await prisma.notification.create({
        data: {
          userId: deposit.userId,
          title: 'Deposit Approved',
          message: `Your deposit of ${deposit.amount} ${deposit.asset} has been credited to your wallet!`,
          type: 'DEPOSIT',
        },
      });
    } else {
      await prisma.depositRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectReason: rejectReason || 'Transaction proof invalid',
          processedAt: new Date(),
          processedBy: req.user!.telegramId,
        },
      });

      await prisma.notification.create({
        data: {
          userId: deposit.userId,
          title: 'Deposit Rejected',
          message: `Your deposit was rejected: ${rejectReason}`,
          type: 'DEPOSIT',
        },
      });
    }

    await logAudit(req.user!.id, `DEPOSIT_${action}`, deposit.id, { userId: deposit.userId, amount: deposit.amount, rejectReason });

    return res.json({ success: true, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DISPUTES
router.get('/disputes', async (_req, res) => {
  try {
    const disputes = await prisma.dispute.findMany({
      include: {
        order: {
          include: {
            buyer: { select: { id: true, firstName: true, telegramId: true } },
            seller: { select: { id: true, firstName: true, telegramId: true } },
          },
        },
        openedBy: { select: { id: true, firstName: true, telegramId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(disputes);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/disputes/:id/settle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    if (!['RELEASE_TO_BUYER', 'REFUND_TO_SELLER'].includes(resolution)) {
      return res.status(400).json({ error: 'Resolution must be RELEASE_TO_BUYER or REFUND_TO_SELLER' });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    if (dispute.status !== 'OPEN') {
      return res.status(400).json({ error: `Dispute is already resolved as ${dispute.status}` });
    }

    const order = dispute.order;

    if (resolution === 'RELEASE_TO_BUYER') {
      await releaseEscrow(order.sellerId, order.buyerId, order.cryptoAmount, order.id);

      await prisma.$transaction([
        prisma.dispute.update({
          where: { id },
          data: {
            status: 'RESOLVED_BUYER',
            resolvedAt: new Date(),
            resolvedBy: req.user!.telegramId,
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        }),
      ]);
    } else {
      await refundEscrow(order.sellerId, order.cryptoAmount, order.id);

      await prisma.$transaction([
        prisma.dispute.update({
          where: { id },
          data: {
            status: 'RESOLVED_SELLER',
            resolvedAt: new Date(),
            resolvedBy: req.user!.telegramId,
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        }),
      ]);
    }

    await logAudit(req.user!.id, 'SETTLE_DISPUTE', dispute.id, { resolution, orderId: order.id });

    return res.json({ success: true, resolution });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// USERS LIST
router.get('/users', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(users);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// AUDIT LOGS
router.get('/audit-logs', async (_req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
