import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { processDepositApproval, releaseEscrow, refundEscrow } from '../lib/ledger.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// Admin Stats Overview
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
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// List KYC Submissions
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

// Review KYC Submission
router.post('/kyc/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, rejectReason } = req.body; // action: "APPROVE" or "REJECT"

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
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

// Manage Admin Payment Accounts
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

// List User Deposit Requests
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

// Review Deposit Request (Approve/Reject)
router.post('/deposits/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, rejectReason } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
    }

    const deposit = await prisma.depositRequest.findUnique({ where: { id } });
    if (!deposit) return res.status(404).json({ error: 'Deposit request not found' });

    if (deposit.status !== 'PENDING') {
      return res.status(400).json({ error: `Deposit is already ${deposit.status}` });
    }

    if (action === 'APPROVE') {
      // Process approval: credits user USDT wallet & logs double-entry ledger
      await processDepositApproval(deposit.userId, deposit.amount, deposit.id);

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
          message: `Your deposit of ${deposit.amount} USDT has been credited to your wallet!`,
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
          message: `Your deposit was rejected: ${rejectReason || 'Proof rejected'}`,
          type: 'DEPOSIT',
        },
      });
    }

    await logAudit(req.user!.id, `DEPOSIT_${action}`, deposit.id, { userId: deposit.userId, amount: deposit.amount });

    return res.json({ success: true, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// List Disputes
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

// Settle Dispute (Admin action)
router.post('/disputes/:id/settle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body; // "RELEASE_TO_BUYER" or "REFUND_TO_SELLER"

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

// Users List
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

// Audit Logs
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
