import { describe, it, expect } from 'vitest';
import { verifyTelegramInitData } from '../src/lib/telegram.js';
import crypto from 'crypto';

describe('Telegram Auth Verification', () => {
  const botToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz';

  it('should verify valid Telegram initData with correct HMAC signature', () => {
    const userJson = JSON.stringify({
      id: 7891606253,
      first_name: 'Admin',
      last_name: 'Ethio',
      username: 'ethio_admin',
    });

    const params = new Map<string, string>();
    params.set('auth_date', '1700000000');
    params.set('user', userJson);

    // Compute secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const dataCheckArr = ['auth_date=1700000000', `user=${userJson}`];
    const dataCheckString = dataCheckArr.join('\n');

    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const initDataRaw = `auth_date=1700000000&user=${encodeURIComponent(userJson)}&hash=${hash}`;

    const result = verifyTelegramInitData(initDataRaw, botToken);

    expect(result.valid).toBe(true);
    expect(result.user?.id).toBe(7891606253);
    expect(result.user?.first_name).toBe('Admin');
  });

  it('should reject tampered initData with invalid hash signature', () => {
    const userJson = JSON.stringify({ id: 999999999, first_name: 'Attacker' });
    const initDataRaw = `auth_date=1700000000&user=${encodeURIComponent(userJson)}&hash=invalidhash123456`;

    const result = verifyTelegramInitData(initDataRaw, botToken);
    expect(result.valid).toBe(false);
  });
});
