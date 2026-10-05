import { prisma } from './prisma.js';

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key },
    });
    return setting ? setting.value : defaultValue;
  } catch (err) {
    console.error(`Error reading setting ${key}:`, err);
    return defaultValue;
  }
}

export async function getNumericSetting(key: string, defaultValue: number): Promise<number> {
  const val = await getSetting(key, defaultValue.toString());
  const num = parseFloat(val);
  return isNaN(num) ? defaultValue : num;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {
    p2p_fee_rate: '0.01',
    deposit_fee_rate: '0.00',
    exchange_rate_etb_usdt: '135.50',
    min_order_usdt: '5.0',
    max_order_usdt: '50000.0',
    maintenance_mode: 'false',
  };

  for (const s of settings) {
    map[s.key] = s.value;
  }

  return map;
}
