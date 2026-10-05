import { prisma } from './prisma.js';

export async function sendTelegramNotification(telegramId: string, messageText: string) {
  const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log(`[Bot Notification Log - No Bot Token Configured] To ${telegramId}:\n${messageText}`);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error(`Failed to send Telegram Bot notification to ${telegramId}:`, err);
  }
}

export function formatStartMessage(): string {
  return `✨ WELCOME TO ETHIO EXCHANGE ✨

🌍 Your Trusted P2P Crypto Marketplace

🪙 Buy & Sell USDT
💱 Fast ETB ↔ USDT Exchange
🔐 Secure Transactions
⚡ Fast & Simple Trading
🛡️ Verified Users

━━━━━━━━━━━━━━━━━━

🚀 Ready to get started?

Tap the button below to open
your ETHIO EXCHANGE account.

👇 Start trading securely 👇`;
}
