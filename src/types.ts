export interface User {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: 'USER' | 'ADMIN';
  accountStatus: 'ACTIVE' | 'BANNED' | 'SUSPENDED';
  kycStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  lastActiveAt?: string;
  createdAt: string;
}

export interface Wallet {
  balanceUsdt: number;
  reservedUsdt: number;
  availableUsdt: number;
  balanceEtb: number;
  reservedEtb: number;
  availableEtb: number;
}

export interface LedgerTransaction {
  id: string;
  userId: string;
  asset: 'USDT' | 'ETB';
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'ESCROW_LOCK' | 'ESCROW_RELEASE' | 'ESCROW_REFUND' | 'FEE' | 'ADMIN_ADJUSTMENT' | 'EXCHANGE';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  referenceId?: string | null;
  description: string;
  createdAt: string;
}

export interface CaptchaChallenge {
  challengeCode: string;
  question: string;
  expiresAt: string;
}

export interface KycSubmission {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  idType: string;
  idNumber: string;
  frontPhoto: string;
  backPhoto?: string | null;
  selfiePhoto: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  user?: Partial<User>;
}

export interface DepositAccount {
  id: string;
  asset: 'ETB' | 'USDT';
  providerName: string;
  accountNumber: string;
  accountName: string;
  instructions?: string | null;
  active: boolean;
  minLimit: number;
  maxLimit: number;
}

export interface DepositRequest {
  id: string;
  userId: string;
  asset: string;
  providerName: string;
  amount: number;
  depositAccountId?: string | null;
  paymentAccountSnapshot?: string | null;
  proofPhoto?: string | null;
  refNumber?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
  user?: Partial<User>;
  depositAccount?: DepositAccount | null;
}

export interface Advertisement {
  id: string;
  userId: string;
  type: 'BUY' | 'SELL';
  cryptoAsset: string;
  fiatCurrency: string;
  price: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string;
  cryptoMethods?: string;
  active: boolean;
  terms?: string | null;
  createdAt: string;
  user?: Partial<User>;
}

export interface Order {
  id: string;
  advertisementId: string;
  buyerId: string;
  sellerId: string;
  cryptoAmount: number;
  fiatAmount: number;
  price: number;
  paymentMethod: string;
  status:
    | 'CREATED'
    | 'PAYMENT_PENDING'
    | 'PAYMENT_SUBMITTED'
    | 'PAYMENT_CONFIRMED'
    | 'RELEASE_PENDING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'DISPUTED';
  proofPhoto?: string | null;
  paymentRef?: string | null;
  rejectionReason?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  expiresAt: string;
  createdAt: string;
  paidAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  buyer?: Partial<User>;
  seller?: Partial<User>;
  advertisement?: Advertisement;
  dispute?: Dispute | null;
}

export interface DisputeMessage {
  id: string;
  disputeId: string;
  senderId: string;
  senderRole: 'BUYER' | 'SELLER' | 'ADMIN';
  message: string;
  attachment?: string | null;
  createdAt: string;
  sender?: Partial<User>;
}

export interface Dispute {
  id: string;
  orderId: string;
  openedById: string;
  status: 'OPEN' | 'RESOLVED_BUYER' | 'RESOLVED_SELLER';
  reason: string;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  order?: Order;
  openedBy?: Partial<User>;
  messages?: DisputeMessage[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  pendingKyc: number;
  pendingDeposits: number;
  activeAds: number;
  openDisputes: number;
  totalBalanceUsdt: number;
  totalReservedUsdt: number;
  totalBalanceEtb: number;
  totalReservedEtb: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetId?: string | null;
  details: string;
  ipAddress?: string | null;
  createdAt: string;
}
