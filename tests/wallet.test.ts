import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  getUserWallet,
  processDepositApproval,
  lockEscrow,
  releaseEscrow,
  refundEscrow,
  recordLedgerEntry,
} from '../src/lib/ledger.js';

describe('Immutable Wallet & Escrow Ledger System', () => {
  let sellerId: string;
  let buyerId: string;

  beforeAll(async () => {
    // Clean database before tests
    await prisma.ledgerTransaction.deleteMany();
    await prisma.order.deleteMany();
    await prisma.advertisement.deleteMany();
    await prisma.user.deleteMany();

    const seller = await prisma.user.create({
      data: {
        telegramId: '11111111',
        firstName: 'Seller User',
        balanceUsdt: 0,
        reservedUsdt: 0,
      },
    });

    const buyer = await prisma.user.create({
      data: {
        telegramId: '22222222',
        firstName: 'Buyer User',
        balanceUsdt: 0,
        reservedUsdt: 0,
      },
    });

    sellerId = seller.id;
    buyerId = buyer.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should initialize wallet with 0 USDT balances', async () => {
    const wallet = await getUserWallet(sellerId);
    expect(wallet.balanceUsdt).toBe(0);
    expect(wallet.reservedUsdt).toBe(0);
    expect(wallet.availableUsdt).toBe(0);
  });

  it('should credit deposit and update available balance with immutable ledger entry', async () => {
    await processDepositApproval(sellerId, 500, 'dep-123');

    const wallet = await getUserWallet(sellerId);
    expect(wallet.balanceUsdt).toBe(500);
    expect(wallet.reservedUsdt).toBe(0);
    expect(wallet.availableUsdt).toBe(500);

    const ledger = await prisma.ledgerTransaction.findFirst({
      where: { userId: sellerId, type: 'DEPOSIT' },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.amount).toBe(500);
    expect(ledger?.balanceAfter).toBe(500);
  });

  it('should lock funds in escrow for seller during P2P order creation', async () => {
    await lockEscrow(sellerId, 200, 'order-456');

    const wallet = await getUserWallet(sellerId);
    expect(wallet.balanceUsdt).toBe(500);
    expect(wallet.reservedUsdt).toBe(200);
    expect(wallet.availableUsdt).toBe(300); // 500 - 200 = 300
  });

  it('should prevent negative available balance when attempting to over-reserve', async () => {
    await expect(lockEscrow(sellerId, 400, 'order-fail')).rejects.toThrow(
      /Insufficient available USDT balance/
    );
  });

  it('should release escrow to buyer upon completion', async () => {
    await releaseEscrow(sellerId, buyerId, 200, 'order-456');

    const sellerWallet = await getUserWallet(sellerId);
    expect(sellerWallet.balanceUsdt).toBe(300);
    expect(sellerWallet.reservedUsdt).toBe(0);
    expect(sellerWallet.availableUsdt).toBe(300);

    const buyerWallet = await getUserWallet(buyerId);
    expect(buyerWallet.balanceUsdt).toBe(200);
    expect(buyerWallet.availableUsdt).toBe(200);
  });

  it('should refund escrow to seller on order cancellation', async () => {
    // Lock 100 USDT
    await lockEscrow(sellerId, 100, 'order-789');
    let wallet = await getUserWallet(sellerId);
    expect(wallet.reservedUsdt).toBe(100);

    // Refund
    await refundEscrow(sellerId, 100, 'order-789');
    wallet = await getUserWallet(sellerId);
    expect(wallet.reservedUsdt).toBe(0);
    expect(wallet.availableUsdt).toBe(300);
  });
});
