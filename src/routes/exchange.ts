import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { getUserWallet, recordLedgerEntry } from '../lib/ledger.js';
import { getNumericSetting } from '../lib/settings.js';

const router = Router();

// Rate endpoint
router.get('/rate', async (_req, res) => {
  try {
    const rate = await getNumericSetting('exchange_rate_etb_usdt', 135.5);
    const feeRate = await getNumericSetting('p2p_fee_rate', 0.01);
    return res.json({ rate, feeRate });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Swap ETB ↔ USDT
router.post('/swap', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { direction, amount } = req.body; // direction: "ETB_TO_USDT" or "USDT_TO_ETB"
    const numAmount = parseFloat(amount);

    if (!direction || !['ETB_TO_USDT', 'USDT_TO_ETB'].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be ETB_TO_USDT or USDT_TO_ETB' });
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid exchange amount' });
    }

    const rate = await getNumericSetting('exchange_rate_etb_usdt', 135.5);
    const feeRate = await getNumericSetting('p2p_fee_rate', 0.01);

    const wallet = await getUserWallet(req.user.id);

    if (direction === 'ETB_TO_USDT') {
      if (wallet.availableEtb < numAmount) {
        return res.status(400).json({
          error: `Insufficient ETB balance (${wallet.availableEtb.toFixed(2)} ETB available)`,
        });
      }

      const grossUsdt = numAmount / rate;
      const feeUsdt = grossUsdt * feeRate;
      const netUsdt = grossUsdt - feeUsdt;

      await recordLedgerEntry(
        req.user.id,
        'EXCHANGE',
        -numAmount,
        0,
        null,
        `Exchanged ${numAmount.toFixed(2)} ETB for ${netUsdt.toFixed(2)} USDT`,
        'ETB'
      );

      await recordLedgerEntry(
        req.user.id,
        'EXCHANGE',
        netUsdt,
        0,
        null,
        `Received ${netUsdt.toFixed(2)} USDT from ETB exchange (Fee: ${feeUsdt.toFixed(2)} USDT)`,
        'USDT'
      );

      return res.json({
        success: true,
        message: `Exchanged ${numAmount.toFixed(2)} ETB for ${netUsdt.toFixed(2)} USDT`,
        netUsdt,
        feeUsdt,
      });
    } else {
      if (wallet.availableUsdt < numAmount) {
        return res.status(400).json({
          error: `Insufficient USDT balance (${wallet.availableUsdt.toFixed(2)} USDT available)`,
        });
      }

      const feeUsdt = numAmount * feeRate;
      const netUsdt = numAmount - feeUsdt;
      const netEtb = netUsdt * rate;

      await recordLedgerEntry(
        req.user.id,
        'EXCHANGE',
        -numAmount,
        0,
        null,
        `Exchanged ${numAmount.toFixed(2)} USDT for ${netEtb.toFixed(2)} ETB`,
        'USDT'
      );

      await recordLedgerEntry(
        req.user.id,
        'EXCHANGE',
        netEtb,
        0,
        null,
        `Received ${netEtb.toFixed(2)} ETB from USDT exchange`,
        'ETB'
      );

      return res.json({
        success: true,
        message: `Exchanged ${numAmount.toFixed(2)} USDT for ${netEtb.toFixed(2)} ETB`,
        netEtb,
        feeUsdt,
      });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
