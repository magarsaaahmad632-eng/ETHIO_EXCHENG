import { prisma } from './prisma.js';

export async function logAudit(
  adminId: string,
  action: string,
  targetId: string | null = null,
  details: Record<string, any> = {},
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        targetId,
        details: JSON.stringify(details),
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
