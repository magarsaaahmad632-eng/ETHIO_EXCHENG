import { prisma } from './prisma.js';

export type LedgerType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'ESCROW_LOCK'
  | 'ESCROW_RELEASE'
  | 'ESCROW_REFUND'
  | 'FEE'
  | 'ADMIN_ADJUSTMENT'
  | 'EXCHANGE';

export interface WalletState {
  balanceUsdt: number;
  reservedUsdt: number;
  availableUsdt: number;
  balanceEtb: number;
  reservedEtb: number;
  availableEtb: number;
}

export async function getUserWallet(userId: string): Promise<WalletState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balanceUsdt: true, reservedUsdt: true, balanceEtb: true, reservedEtb: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const balanceUsdt = Number(user.balanceUsdt) || 0;
  const reservedUsdt = Number(user.reservedUsdt) || 0;
  const availableUsdt = Math.max(0, balanceUsdt - reservedUsdt);

  const balanceEtb = Number(user.balanceEtb) || 0;
  const reservedEtb = Number(user.reservedEtb) || 0;
  const availableEtb = Math.max(0, balanceEtb - reservedEtb);

  return { balanceUsdt, reservedUsdt, availableUsdt, balanceEtb, reservedEtb, availableEtb };
}

export async function recordLedgerEntry(
  userId: string,
  type: LedgerType,
  amount: number,
  deltaReserved: number,
  referenceId: string | null,
  description: string,
  asset: 'USDT' | 'ETB' = 'USDT'
) {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const isUsdt = asset === 'USDT';
    const currentBalance = isUsdt ? Number(user.balanceUsdt) || 0 : Number(user.balanceEtb) || 0;
    const currentReserved = isUsdt ? Number(user.reservedUsdt) || 0 : Number(user.reservedEtb) || 0;

    const newBalance = currentBalance + amount;
    const newReserved = currentReserved + deltaReserved;

    if (newBalance < -0.000001) {
      throw new Error(`Insufficient ${asset} funds: Balance would become negative (${newBalance})`);
    }
    if (newReserved < -0.000001) {
      throw new Error(`Invalid reserved state: ${asset} reserved balance would become negative (${newReserved})`);
    }
    if (newBalance < newReserved - 0.000001) {
      throw new Error(`Insufficient available ${asset} balance: Balance (${newBalance}) < Reserved (${newReserved})`);
    }

    const updateData = isUsdt
      ? { balanceUsdt: newBalance, reservedUsdt: newReserved }
      : { balanceEtb: newBalance, reservedEtb: newReserved };

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: updateData,
    });

    const ledger = await tx.ledgerTransaction.create({
      data: {
        userId,
        asset,
        type,
        amount: Math.abs(amount),
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        reservedBefore: currentReserved,
        reservedAfter: newReserved,
        referenceId,
        description,
      },
    });

    return { updatedUser, ledger };
  });
}

// Deposit approval: Increase total balance
export async function processDepositApproval(userId: string, amount: number, depositRequestId: string, asset: 'USDT' | 'ETB' = 'USDT') {
  return await recordLedgerEntry(
    userId,
    'DEPOSIT',
    amount,
    0,
    depositRequestId,
    `Deposit of ${amount} ${asset} approved`,
    asset
  );
}

// Escrow Lock: Reserve funds
export async function lockEscrow(sellerId: string, amount: number, orderId: string, asset: 'USDT' | 'ETB' = 'USDT') {
  return await recordLedgerEntry(
    sellerId,
    'ESCROW_LOCK',
    0,
    amount,
    orderId,
    `Escrow locked for P2P order #${orderId}`,
    asset
  );
}

// Escrow Release: Transfer reserved funds from seller to buyer
export async function releaseEscrow(sellerId: string, buyerId: string, amount: number, orderId: string, asset: 'USDT' | 'ETB' = 'USDT') {
  return await prisma.$transaction(async (tx) => {
    const isUsdt = asset === 'USDT';
    const seller = await tx.user.findUnique({ where: { id: sellerId } });
    if (!seller) throw new Error('Seller not found');

    const sellerBal = isUsdt ? Number(seller.balanceUsdt) : Number(seller.balanceEtb);
    const sellerRes = isUsdt ? Number(seller.reservedUsdt) : Number(seller.reservedEtb);

    if (sellerRes < amount - 0.000001 || sellerBal < amount - 0.000001) {
      throw new Error(`Seller has insufficient reserved escrow balance (${asset})`);
    }

    const sellerNewBal = sellerBal - amount;
    const sellerNewRes = sellerRes - amount;

    const sellerUpdate = isUsdt
      ? { balanceUsdt: sellerNewBal, reservedUsdt: sellerNewRes }
      : { balanceEtb: sellerNewBal, reservedEtb: sellerNewRes };

    await tx.user.update({
      where: { id: sellerId },
      data: sellerUpdate,
    });

    await tx.ledgerTransaction.create({
      data: {
        userId: sellerId,
        asset,
        type: 'ESCROW_RELEASE',
        amount,
        balanceBefore: sellerBal,
        balanceAfter: sellerNewBal,
        reservedBefore: sellerRes,
        reservedAfter: sellerNewRes,
        referenceId: orderId,
        description: `Released ${amount} ${asset} to buyer for order #${orderId}`,
      },
    });

    const buyer = await tx.user.findUnique({ where: { id: buyerId } });
    if (!buyer) throw new Error('Buyer not found');

    const buyerBal = isUsdt ? Number(buyer.balanceUsdt) : Number(buyer.balanceEtb);
    const buyerRes = isUsdt ? Number(buyer.reservedUsdt) : Number(buyer.reservedEtb);

    const buyerNewBal = buyerBal + amount;

    const buyerUpdate = isUsdt ? { balanceUsdt: buyerNewBal } : { balanceEtb: buyerNewBal };

    await tx.user.update({
      where: { id: buyerId },
      data: buyerUpdate,
    });

    await tx.ledgerTransaction.create({
      data: {
        userId: buyerId,
        asset,
        type: 'DEPOSIT',
        amount,
        balanceBefore: buyerBal,
        balanceAfter: buyerNewBal,
        reservedBefore: buyerRes,
        reservedAfter: buyerRes,
        referenceId: orderId,
        description: `Received ${amount} ${asset} from P2P order #${orderId}`,
      },
    });

    return { sellerNewBal, buyerNewBal };
  });
}

// Escrow Refund: Unlock reserved funds back to seller available balance
export async function refundEscrow(sellerId: string, amount: number, orderId: string, asset: 'USDT' | 'ETB' = 'USDT') {
  return await recordLedgerEntry(
    sellerId,
    'ESCROW_REFUND',
    0,
    -amount,
    orderId,
    `Escrow refunded for order #${orderId}`,
    asset
  );
}
