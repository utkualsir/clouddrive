import { Router, Response, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { PLANS, PAYMENT_INFO, CURRENCY_SYMBOLS } from '../config/plans';
import { sendPaymentRequestAdminNotification } from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

const ADMIN_EMAIL = 'redmotiontr@gmail.com';
const VALID_CURRENCIES = ['TRY', 'USD', 'EUR'] as const;
type ValidCurrency = (typeof VALID_CURRENCIES)[number];

// GET /api/payments/plans — public
router.get('/plans', async (_req: Request, res: Response): Promise<void> => {
  try {
    const plansWithMethods = PLANS.map(plan => ({
      ...plan,
      paymentMethods: Object.entries(PAYMENT_INFO).map(([currency, info]) => ({
        currency,
        label: info.label,
        active: info.active,
        comingSoon: 'comingSoon' in info ? info.comingSoon : false,
      })),
    }));
    res.json({ success: true, data: plansWithMethods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

// GET /api/payments/info — auth required, returns IBANs
router.get('/info', authenticateToken, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const info = Object.entries(PAYMENT_INFO).map(([currency, data]) => ({
      currency,
      symbol: CURRENCY_SYMBOLS[currency] ?? currency,
      label: data.label,
      iban: data.iban,
      active: data.active,
      comingSoon: 'comingSoon' in data ? data.comingSoon : false,
    }));
    res.json({ success: true, data: info });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch payment info' });
  }
});

// POST /api/payments/request — auth required
router.post('/request', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { type, plan, amount, currency, note } = req.body as {
      type?: string;
      plan?: string;
      amount?: unknown;
      currency?: string;
      note?: string;
    };

    if (!type || !['UPGRADE', 'DONATE'].includes(type)) {
      res.status(400).json({ success: false, error: 'type must be UPGRADE or DONATE' });
      return;
    }

    if (!currency || !(VALID_CURRENCIES as readonly string[]).includes(currency)) {
      res.status(400).json({ success: false, error: 'currency must be TRY, USD, or EUR' });
      return;
    }

    const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount ?? ''));
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({ success: false, error: 'amount must be a positive number' });
      return;
    }

    let storageGB: number | undefined;
    let planName: string | undefined;

    if (type === 'UPGRADE') {
      if (!plan) {
        res.status(400).json({ success: false, error: 'plan is required for UPGRADE requests' });
        return;
      }
      const planConfig = PLANS.find(p => p.id === plan);
      if (!planConfig) {
        res.status(400).json({ success: false, error: 'Invalid plan ID' });
        return;
      }
      storageGB = planConfig.storageGB;
      planName = planConfig.name;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true, email: true },
    });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        userId,
        type: type as 'UPGRADE' | 'DONATE',
        plan: plan ?? null,
        storageGB: storageGB ?? null,
        amount: amountNum,
        currency,
        note: note?.trim() ?? null,
      },
    });

    const symbol = CURRENCY_SYMBOLS[currency as ValidCurrency] ?? currency;
    const adminUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/admin`;

    sendPaymentRequestAdminNotification(ADMIN_EMAIL, {
      type,
      displayName: user.displayName,
      username: user.username,
      planName,
      storageGB,
      amount: amountNum,
      currency,
      symbol,
      note: note?.trim(),
      adminUrl,
      createdAt: paymentRequest.createdAt.toISOString(),
    }).catch(console.error);

    res.status(201).json({
      success: true,
      data: { id: paymentRequest.id, status: paymentRequest.status },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to submit payment request' });
  }
});

// GET /api/payments/requests — auth required, current user's requests
router.get('/requests', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await prisma.paymentRequest.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch payment requests' });
  }
});

// GET /api/payments/status — auth required (current plan info for SettingsPage)
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { plan: true, storageLimit: true },
    });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({
      success: true,
      data: { plan: user.plan, storageLimit: user.storageLimit.toString() },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch payment status' });
  }
});

export default router;
