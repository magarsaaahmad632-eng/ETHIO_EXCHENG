import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthenticatedRequest } from '../lib/auth.js';
import { generateCaptchaChallenge, verifyCaptchaChallenge } from '../lib/captcha.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'kyc');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `kyc-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Generate CAPTCHA
router.get('/captcha', async (_req, res) => {
  try {
    const captcha = await generateCaptchaChallenge();
    return res.json(captcha);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Get user KYC status and latest submission
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const submission = await prisma.kycSubmission.findFirst({
      where: { userId: req.user.id },
      orderBy: { submittedAt: 'desc' },
    });

    return res.json({
      kycStatus: req.user.kycStatus,
      submission,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Submit KYC Verification with real server-verified CAPTCHA
router.post(
  '/submit',
  authenticateToken,
  upload.fields([
    { name: 'frontPhoto', maxCount: 1 },
    { name: 'backPhoto', maxCount: 1 },
    { name: 'selfiePhoto', maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { challengeCode, captchaAnswer, fullName, phoneNumber, idType, idNumber } = req.body;

      if (!challengeCode || !captchaAnswer) {
        return res.status(400).json({ error: 'Captcha challenge code and answer are required' });
      }

      const captchaValid = await verifyCaptchaChallenge(challengeCode, captchaAnswer);
      if (!captchaValid) {
        return res.status(400).json({ error: 'Incorrect or expired "I am not a robot" CAPTCHA answer' });
      }

      if (!fullName || !phoneNumber || !idType || !idNumber) {
        return res.status(400).json({ error: 'Missing required profile and ID details' });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const frontPhotoFile = files?.frontPhoto?.[0];
      const selfiePhotoFile = files?.selfiePhoto?.[0];
      const backPhotoFile = files?.backPhoto?.[0];

      if (!frontPhotoFile || !selfiePhotoFile) {
        return res.status(400).json({ error: 'Front ID photo and Selfie with ID are required' });
      }

      const frontPhoto = `/uploads/kyc/${frontPhotoFile.filename}`;
      const selfiePhoto = `/uploads/kyc/${selfiePhotoFile.filename}`;
      const backPhoto = backPhotoFile ? `/uploads/kyc/${backPhotoFile.filename}` : undefined;

      // Upsert KYC submission and update User status
      const submission = await prisma.kycSubmission.create({
        data: {
          userId: req.user.id,
          fullName,
          phoneNumber,
          idType,
          idNumber,
          frontPhoto,
          backPhoto,
          selfiePhoto,
          status: 'PENDING',
        },
      });

      await prisma.user.update({
        where: { id: req.user.id },
        data: { kycStatus: 'PENDING' },
      });

      return res.json({
        success: true,
        message: 'KYC submission received and is under review',
        submission,
      });
    } catch (error: any) {
      console.error('KYC submit error:', error);
      return res.status(500).json({ error: error.message || 'Failed to submit KYC' });
    }
  }
);

export default router;
