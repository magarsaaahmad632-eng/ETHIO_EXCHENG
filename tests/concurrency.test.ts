import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { lockEscrow, getUserWallet } from '../src/lib/ledger.js';

describe('Concurrent Escrow Reservation & Over-Spend Protection', () => {
  let sellerId: string;

  beforeAll(async () => {
    // Create seller with 100 USDT available
    const seller = await prisma.user.create({
      data: {
        telegramId: 'concurrent_seller_1',
        firstName: 'Concurrent Seller',
        balanceUsdt: 100,
        reservedUsdt: 0,
      },
    });
    sellerId = seller.id;
  });

  afterAll(async () => {
    await prisma.ledgerTransaction.deleteMany({ where: { userId: sellerId } });
    await prisma.user.delete({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  it('should prevent two concurrent orders from spending the same reserved funds', async () => {
    // Attempt two simultaneous orders of 80 USDT each when seller only has 100 USDT available
    const order1Promise = lockEscrow(sellerId, 80, 'order-concurrent-1');
    const order2Promise = lockEscrow(sellerId, 80, 'order-concurrent-2');

    const results = await Promise.allSettled([order1Promise, order2Promise]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 1 order must succeed and 1 must fail due to insufficient available balance
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const wallet = await getUserWallet(sellerId);
    expect(wallet.reservedUsdt).toBe(80);
    expect(wallet.availableUsdt).toBe(20);
  });
});
