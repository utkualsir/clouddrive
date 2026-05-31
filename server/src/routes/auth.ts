import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { UAParser } from 'ua-parser-js';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendLoginAlertEmail,
  sendPasswordChangedEmail,
  sendReferralBonusEmail,
} from '../services/emailService';
import { generateToken, awardBadge } from '../utils/helpers';
import { broadcastToAll } from '../websocket';

const router = Router();
const prisma = new PrismaClient();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

function signToken(payload: { id: string; email: string; role: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

function signTempToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ id: userId, requiresTwoFactor: true }, secret, { expiresIn: '5m' });
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]).trim();
  return req.socket.remoteAddress ?? 'Unknown';
}

async function recordLogin(userId: string, req: Request): Promise<{ isNew: boolean }> {
  const ua = req.headers['user-agent'] ?? '';
  const parser = new UAParser(ua);
  const result = parser.getResult();

  const browser = result.browser.name ?? 'Unknown';
  const os = result.os.name ?? 'Unknown';
  const deviceType = result.device.type ?? 'desktop';
  const deviceName = result.device.vendor
    ? `${result.device.vendor} ${result.device.model ?? ''}`.trim()
    : `${os} ${deviceType}`;

  const ipAddress = getClientIp(req);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { knownDevices: true } });
  let knownDevices: string[] = [];
  try { knownDevices = JSON.parse(user?.knownDevices ?? '[]') as string[]; } catch { /* ignore */ }

  const deviceFingerprint = `${browser}|${os}|${deviceType}`;
  const isNew = !knownDevices.includes(deviceFingerprint);

  if (isNew) {
    knownDevices.push(deviceFingerprint);
    await prisma.user.update({ where: { id: userId }, data: { knownDevices: JSON.stringify(knownDevices) } });
  }

  await prisma.loginHistory.updateMany({ where: { userId }, data: { isCurrent: false } });

  await prisma.loginHistory.create({
    data: { userId, ipAddress, userAgent: ua, deviceName, browser, os, isCurrent: true },
  });

  const count = await prisma.loginHistory.count({ where: { userId } });
  if (count > 10) {
    const oldest = await prisma.loginHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (oldest) await prisma.loginHistory.delete({ where: { id: oldest.id } });
  }

  return { isNew };
}

function generateReferralCode(username: string): string {
  const prefix = username.slice(0, 4).toUpperCase().padEnd(4, 'X');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return prefix + suffix;
}

router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, displayName, referralCode } = req.body as {
      email: string; username: string; password: string; displayName: string; referralCode?: string;
    };

    if (!email || !username || !password || !displayName) {
      res.status(400).json({ success: false, error: 'All fields are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      const field = existing.email === email ? 'Email' : 'Username';
      res.status(409).json({ success: false, error: `${field} already in use` });
      return;
    }

    // Validate referral code if provided
    let referrer: { id: string; email: string; displayName: string; emailNotifications: boolean } | null = null;
    if (referralCode) {
      referrer = await prisma.user.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        select: { id: true, email: true, displayName: true, emailNotifications: true },
      });
    }

    const hashed = await bcrypt.hash(password, 12);
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    // Generate unique referral code
    let newReferralCode: string;
    let attempts = 0;
    do {
      newReferralCode = generateReferralCode(username);
      const collision = await prisma.user.findUnique({ where: { referralCode: newReferralCode }, select: { id: true } });
      if (!collision) break;
      attempts++;
    } while (attempts < 10);

    const bonusBytes = referrer ? BigInt(5) * BigInt(1024) * BigInt(1024) * BigInt(1024) : BigInt(0);

    const user = await prisma.user.create({
      data: {
        email, username, password: hashed, displayName, avatarColor,
        referralCode: newReferralCode,
        referredBy: referrer?.id ?? null,
        storageLimit: BigInt('5368709120') + bonusBytes,
        bonusStorageGB: referrer ? 5 : 0,
      },
    });

    await awardBadge(prisma, user.id, 'early_adopter');

    // Handle referral bonuses
    if (referrer) {
      await prisma.referral.create({
        data: { referrerId: referrer.id, referredId: user.id, bonusGranted: true },
      });
      const referrerBonus = BigInt(5) * BigInt(1024) * BigInt(1024) * BigInt(1024);
      await prisma.user.update({
        where: { id: referrer.id },
        data: {
          referralCount: { increment: 1 },
          bonusStorageGB: { increment: 5 },
          storageLimit: { increment: referrerBonus },
        },
      });
      // Notify referrer
      await prisma.notification.create({
        data: {
          userId: referrer.id,
          type: 'SYSTEM',
          message: `${user.displayName} joined CloudDrive using your referral! You both got 5 GB bonus storage 🎉`,
        },
      });
      if (referrer.emailNotifications) {
        sendReferralBonusEmail(referrer.email, referrer.displayName, user.displayName).catch(console.error);
      }
    }

    sendWelcomeEmail(user.email, user.displayName).catch(console.error);

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({
      success: true,
      data: {
        token,
        referralBonusGranted: !!referrer,
        user: {
          id: user.id, email: user.email, username: user.username,
          displayName: user.displayName, avatarColor: user.avatarColor,
          role: user.role, onboardingCompleted: user.onboardingCompleted,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[register] Unhandled error:', message);
    if (err instanceof Error && 'code' in err) {
      console.error('[register] Prisma/DB error code:', (err as { code?: string }).code);
    }
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      const tempToken = signTempToken(user.id);
      res.json({ success: true, data: { requiresTwoFactor: true, tempToken } });
      return;
    }

    // Device tracking + login history (async, non-blocking)
    recordLogin(user.id, req).then(({ isNew }) => {
      if (isNew && user.emailNotifications) {
        const ua = req.headers['user-agent'] ?? '';
        const parser = new UAParser(ua);
        const r = parser.getResult();
        sendLoginAlertEmail(
          user.email,
          user.displayName,
          getClientIp(req),
          r.browser.name ?? 'Unknown',
          r.os.name ?? 'Unknown',
          r.device.vendor ? `${r.device.vendor} ${r.device.model ?? ''}`.trim() : `${r.os.name ?? 'Unknown'} device`,
        ).catch(console.error);
      }
    }).catch(console.error);

    broadcastToAll({
      type: 'user_online',
      userId: user.id,
      displayName: user.displayName,
      timestamp: new Date().toISOString(),
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id, email: user.email, username: user.username,
          displayName: user.displayName, avatarColor: user.avatarColor,
          role: user.role, onboardingCompleted: user.onboardingCompleted,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/2fa/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, code } = req.body as { tempToken: string; code: string };
    if (!tempToken || !code) {
      res.status(400).json({ success: false, error: 'Token and code are required' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) { res.status(500).json({ success: false, error: 'Server error' }); return; }

    let payload: { id: string; requiresTwoFactor?: boolean };
    try {
      payload = jwt.verify(tempToken, secret) as { id: string; requiresTwoFactor?: boolean };
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    if (!payload.requiresTwoFactor) {
      res.status(400).json({ success: false, error: 'Invalid token type' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(400).json({ success: false, error: '2FA not enabled' });
      return;
    }

    // Verify TOTP code
    const totpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!totpValid) {
      // Try backup codes
      let backupCodes: string[] = [];
      try { backupCodes = JSON.parse(user.twoFactorBackupCodes) as string[]; } catch { /* ignore */ }

      let backupUsed = false;
      const updatedCodes: string[] = [];
      for (const hashed of backupCodes) {
        if (!backupUsed && await bcrypt.compare(code, hashed)) {
          backupUsed = true;
        } else {
          updatedCodes.push(hashed);
        }
      }

      if (!backupUsed) {
        res.status(401).json({ success: false, error: 'Invalid authentication code' });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: JSON.stringify(updatedCodes) },
      });
    }

    recordLogin(user.id, req).then(({ isNew }) => {
      if (isNew && user.emailNotifications) {
        const ua = req.headers['user-agent'] ?? '';
        const parser = new UAParser(ua);
        const r = parser.getResult();
        sendLoginAlertEmail(
          user.email,
          user.displayName,
          getClientIp(req),
          r.browser.name ?? 'Unknown',
          r.os.name ?? 'Unknown',
          r.device.vendor ? `${r.device.vendor} ${r.device.model ?? ''}`.trim() : `${r.os.name ?? 'Unknown'} device`,
        ).catch(console.error);
      }
    }).catch(console.error);

    broadcastToAll({
      type: 'user_online',
      userId: user.id,
      displayName: user.displayName,
      timestamp: new Date().toISOString(),
    });

    const fullToken = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      success: true,
      data: {
        token: fullToken,
        user: {
          id: user.id, email: user.email, username: user.username,
          displayName: user.displayName, avatarColor: user.avatarColor,
          role: user.role, onboardingCompleted: user.onboardingCompleted,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '2FA login failed' });
  }
});

router.post('/2fa/setup', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true } });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const secret = speakeasy.generateSecret({
      name: `CloudDrive:${user.email}`,
      length: 20,
    });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { twoFactorTempSecret: secret.base32 },
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url ?? '');

    res.json({
      success: true,
      data: { qrCodeUrl, secret: secret.base32 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '2FA setup failed' });
  }
});

router.post('/2fa/verify-setup', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body as { token: string };
    if (!token) { res.status(400).json({ success: false, error: 'Code is required' }); return; }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { twoFactorTempSecret: true },
    });
    if (!user?.twoFactorTempSecret) {
      res.status(400).json({ success: false, error: '2FA setup not initiated' });
      return;
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorTempSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) {
      res.status(400).json({ success: false, error: 'Invalid code' });
      return;
    }

    // Generate 8 backup codes
    const rawCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );
    const hashedCodes = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        twoFactorSecret: user.twoFactorTempSecret,
        twoFactorTempSecret: null,
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      },
    });

    res.json({ success: true, data: { backupCodes: rawCodes } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '2FA verification failed' });
  }
});

router.post('/2fa/disable', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body as { password: string };
    if (!password) { res.status(400).json({ success: false, error: 'Password is required' }); return; }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const match = await bcrypt.compare(password, user.password);
    if (!match) { res.status(401).json({ success: false, error: 'Incorrect password' }); return; }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorTempSecret: null,
        twoFactorBackupCodes: '[]',
      },
    });

    res.json({ success: true, message: '2FA disabled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to disable 2FA' });
  }
});

router.post('/forgot-password', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email: string };
    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.json({ success: true, message: 'If an account exists, a reset email was sent.' });
      return;
    }

    const token = generateToken(64);
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetExpires: expires },
    });

    await sendPasswordResetEmail(user.email, token, user.displayName);
    res.json({ success: true, message: 'If an account exists, a reset email was sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send reset email' });
  }
});

router.post('/reset-password', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body as { token: string; password: string };

    if (!token || !password) {
      res.status(400).json({ success: false, error: 'Token and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetExpires: { gt: new Date() } },
    });

    if (!user) {
      res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetExpires: null },
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, username: true, displayName: true,
        avatarColor: true, storageUsed: true, storageLimit: true,
        role: true, createdAt: true, onboardingCompleted: true,
        twoFactorEnabled: true, emailNotifications: true, plan: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...user,
        storageUsed: user.storageUsed.toString(),
        storageLimit: user.storageLimit.toString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

router.put('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { displayName } = req.body as { displayName: string };
    if (!displayName || displayName.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Display name is required' });
      return;
    }
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { displayName: displayName.trim() },
      select: {
        id: true, email: true, username: true, displayName: true,
        avatarColor: true, storageUsed: true, storageLimit: true,
        role: true, createdAt: true, onboardingCompleted: true,
        twoFactorEnabled: true, emailNotifications: true,
      },
    });
    res.json({
      success: true,
      data: {
        ...user,
        storageUsed: user.storageUsed.toString(),
        storageLimit: user.storageLimit.toString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

router.put('/password', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Both passwords are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) { res.status(401).json({ success: false, error: 'Current password is incorrect' }); return; }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    if (user.emailNotifications) {
      sendPasswordChangedEmail(user.email, user.displayName).catch(console.error);
    }

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

export default router;
