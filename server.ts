import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import kycRoutes from './src/routes/kyc.js';
import walletRoutes from './src/routes/wallet.js';
import depositRoutes from './src/routes/deposits.js';
import p2pRoutes from './src/routes/p2p.js';
import orderRoutes from './src/routes/orders.js';
import disputeRoutes from './src/routes/disputes.js';
import notificationRoutes from './src/routes/notifications.js';
import adminRoutes from './src/routes/admin.js';
import exchangeRoutes from './src/routes/exchange.js';
import { prisma } from './src/lib/prisma.js';
import { formatStartMessage } from './src/lib/botNotifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration defaulting to '*' if CORS_ORIGIN is not provided
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads route
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/p2p', p2pRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/exchange', exchangeRoutes);

app.get('/api/health', (req, res) => {
  const hostUrl = `${req.protocol}://${req.headers.host}`;
  res.json({
    status: 'ok',
    service: 'ETHIO EXCHANGE API',
    webAppUrl: process.env.WEBAPP_URL || process.env.APP_URL || hostUrl,
    timestamp: new Date().toISOString(),
  });
});

// Telegram Bot Webhook endpoint with dynamic URL detection
app.post('/api/bot/webhook', (req, res) => {
  const update = req.body;
  const computedAppUrl = process.env.WEBAPP_URL || process.env.APP_URL || `${req.protocol}://${req.headers.host}`;

  if (update?.message?.text === '/start') {
    const startMsg = formatStartMessage();
    res.json({
      method: 'sendMessage',
      chat_id: update.message.chat.id,
      text: startMsg,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 OPEN ETHIO EXCHANGE', web_app: { url: computedAppUrl } }],
        ],
      },
    });
    return;
  }
  res.json({ ok: true });
});

async function seedDefaultData() {
  try {
    const existingAccounts = await prisma.depositAccount.count();
    if (existingAccounts === 0) {
      await prisma.depositAccount.createMany({
        data: [
          {
            asset: 'ETB',
            providerName: 'Telebirr',
            accountNumber: '0911223344',
            accountName: 'ETHIO EXCHANGE ESCROW',
            instructions: 'Send Telebirr payment and include your order or deposit reference.',
            minLimit: 100,
            maxLimit: 500000,
          },
          {
            asset: 'ETB',
            providerName: 'CBE Commercial Bank of Ethiopia',
            accountNumber: '1000123456789',
            accountName: 'ETHIO EXCHANGE OFFICIAL',
            instructions: 'Transfer via CBE Birr or Mobile Banking.',
            minLimit: 500,
            maxLimit: 1000000,
          },
          {
            asset: 'USDT',
            providerName: 'USDT TRC20 Wallet',
            accountNumber: 'TETHIOEXCHANGE11223344556677889900',
            accountName: 'ETHIO EXCHANGE TRC20 DEPOSIT',
            instructions: 'Send USDT TRC20 only. 1 network confirmation required.',
            minLimit: 10,
            maxLimit: 50000,
          },
        ],
      });
      console.log('Seeded default admin payment accounts');
    }

    // Seed default settings
    const existingSettings = await prisma.setting.count();
    if (existingSettings === 0) {
      await prisma.setting.createMany({
        data: [
          { key: 'p2p_fee_rate', value: '0.01' },
          { key: 'deposit_fee_rate', value: '0.00' },
          { key: 'exchange_rate_etb_usdt', value: '135.50' },
          { key: 'min_order_usdt', value: '5.0' },
          { key: 'max_order_usdt', value: '50000.0' },
          { key: 'maintenance_mode', value: 'false' },
        ],
      });
      console.log('Seeded default database settings');
    }
  } catch (err) {
    console.error('Error seeding initial data:', err);
  }
}

async function startServer() {
  await seedDefaultData();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, () => {
    console.log(`🚀 ETHIO EXCHANGE Server running on port ${PORT}`);
  });
}

startServer();
