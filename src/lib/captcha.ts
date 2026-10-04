import crypto from 'crypto';
import { prisma } from './prisma.js';

export async function generateCaptchaChallenge() {
  const num1 = Math.floor(Math.random() * 20) + 5;
  const num2 = Math.floor(Math.random() * 20) + 1;
  const answer = (num1 + num2).toString();
  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  await prisma.captchaChallenge.create({
    data: {
      code,
      answer,
      expiresAt,
    },
  });

  return {
    challengeCode: code,
    question: `Please solve: What is ${num1} + ${num2}?`,
    expiresAt,
  };
}

export async function verifyCaptchaChallenge(code: string, userAnswer: string): Promise<boolean> {
  if (!code || !userAnswer) return false;

  const challenge = await prisma.captchaChallenge.findUnique({
    where: { code },
  });

  if (!challenge) return false;

  if (challenge.solved || challenge.expiresAt < new Date()) {
    return false;
  }

  const isCorrect = challenge.answer.trim() === userAnswer.trim();

  if (isCorrect) {
    await prisma.captchaChallenge.update({
      where: { code },
      data: { solved: true },
    });
  }

  return isCorrect;
}
