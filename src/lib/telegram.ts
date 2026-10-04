import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface ParsedInitData {
  user?: TelegramUser;
  auth_date?: number;
  hash?: string;
  query_id?: string;
}

export function parseInitData(initDataRaw: string): ParsedInitData {
  const params = new URLSearchParams(initDataRaw);
  const result: Record<string, any> = {};

  for (const [key, value] of params.entries()) {
    if (key === 'user') {
      try {
        result.user = JSON.parse(value);
      } catch (e) {
        // ignore parse error
      }
    } else if (key === 'auth_date') {
      result.auth_date = parseInt(value, 10);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function verifyTelegramInitData(initDataRaw: string, botToken: string): { valid: boolean; user?: TelegramUser; reason?: string } {
  if (!initDataRaw) {
    return { valid: false, reason: 'Missing initData string' };
  }

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');

  if (!hash) {
    return { valid: false, reason: 'Missing hash parameter' };
  }

  // Remove hash and create sorted key-value pairs
  const dataCheckArr: string[] = [];
  const keys = Array.from(params.keys()).filter((k) => k !== 'hash').sort();

  for (const key of keys) {
    dataCheckArr.push(`${key}=${params.get(key)}`);
  }

  const dataCheckString = dataCheckArr.join('\n');

  // Compute secret key: HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Compute hash: HMAC-SHA256(secretKey, dataCheckString)
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const valid = calculatedHash === hash;
  const parsed = parseInitData(initDataRaw);

  if (!valid) {
    return { valid: false, reason: 'HMAC signature verification failed' };
  }

  return {
    valid: true,
    user: parsed.user,
  };
}
