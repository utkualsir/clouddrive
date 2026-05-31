import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'redmotiontr@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">&#9729; CloudDrive</h1>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Secure Cloud Storage</p>
            </td>
          </tr>
          <tr>
            <td style="padding:48px 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">© 2024 CloudDrive. All rights reserved.</p>
              <p style="color:#9ca3af;font-size:11px;margin:0;">You're receiving this because you have an account on CloudDrive. To manage notifications, visit your <a href="${FRONTEND_URL}/settings" style="color:#6366f1;text-decoration:none;">account settings</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<div style="text-align:center;margin:32px 0;">
    <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">${label}</a>
  </div>`;
}

export async function sendPasswordResetEmail(to: string, token: string, displayName: string): Promise<void> {
  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">Password Reset Request</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">Hi <strong style="color:#111827;">${displayName}</strong>,</p>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 32px;">
      We received a request to reset your CloudDrive password. Click the button below to create a new password. This link expires in <strong style="color:#111827;">1 hour</strong>.
    </p>
    ${ctaButton(resetLink, 'Reset My Password')}
    <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 8px;">Or copy this link into your browser:</p>
    <p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;font-size:12px;color:#6366f1;word-break:break-all;margin:0 0 32px;">${resetLink}</p>
    <div style="border-top:1px solid #e5e7eb;padding-top:24px;">
      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  `);
  await transporter.sendMail({ from: '"CloudDrive" <redmotiontr@gmail.com>', to, subject: 'CloudDrive - Password Reset Request', html });
}

export async function sendWelcomeEmail(to: string, displayName: string): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">Welcome to CloudDrive, ${displayName}! 🎉</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">
      We're thrilled to have you on board. Your secure cloud storage is ready. Here's what you can do right now:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      ${[
        ['☁️', 'Upload files', 'Drag & drop or click to upload any file up to your storage limit.'],
        ['📁', 'Organize with folders', 'Create color-coded, lockable folders to keep things tidy.'],
        ['🔗', 'Share instantly', 'Generate share links with optional passwords and expiry dates.'],
        ['📊', 'Track your storage', 'Monitor usage, view analytics, and manage file versions.'],
      ].map(([icon, title, desc]) => `
      <tr>
        <td style="padding:10px 0;vertical-align:top;width:36px;font-size:20px;">${icon}</td>
        <td style="padding:10px 0 10px 12px;border-bottom:1px solid #f3f4f6;">
          <p style="margin:0 0 4px;font-weight:600;color:#111827;font-size:14px;">${title}</p>
          <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">${desc}</p>
        </td>
      </tr>`).join('')}
    </table>
    ${ctaButton(`${FRONTEND_URL}/drive`, 'Go to my drive')}
    <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">You have 5 GB of free storage to start.</p>
  `);
  await transporter.sendMail({ from: '"CloudDrive" <redmotiontr@gmail.com>', to, subject: `Welcome to CloudDrive, ${displayName}!`, html });
}

export async function sendFileSharedEmail(
  to: string,
  fromName: string,
  fileName: string,
  shareLink: string,
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">A file was shared with you</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 8px;">
      <strong style="color:#111827;">${fromName}</strong> shared a file with you on CloudDrive:
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;display:flex;align-items:center;">
      <span style="font-size:32px;margin-right:12px;">📄</span>
      <div>
        <p style="margin:0;font-weight:600;color:#111827;font-size:15px;">${fileName}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Click the button below to view or download</p>
      </div>
    </div>
    ${ctaButton(shareLink, 'View shared file')}
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">This link may be password-protected or have an expiry date.</p>
  `);
  await transporter.sendMail({ from: '"CloudDrive" <redmotiontr@gmail.com>', to, subject: `${fromName} shared a file with you on CloudDrive`, html });
}

export async function sendLoginAlertEmail(
  to: string,
  displayName: string,
  ipAddress: string,
  browser: string,
  os: string,
  deviceName: string,
): Promise<void> {
  const time = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">New sign-in detected</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">
      Hi <strong style="color:#111827;">${displayName}</strong>, we noticed a new sign-in to your CloudDrive account.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:4px;margin:0 0 28px;">
      ${[
        ['Device', deviceName || 'Unknown device'],
        ['Browser', browser],
        ['Operating system', os],
        ['IP address', ipAddress],
        ['Time', time],
      ].map(([label, value]) => `
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:140px;border-bottom:1px solid #e5e7eb;">${label}</td>
        <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;">${value}</td>
      </tr>`).join('')}
    </table>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 16px;">
      If this was you, no action is needed. If you don't recognize this sign-in, secure your account immediately.
    </p>
    ${ctaButton(`${FRONTEND_URL}/settings`, 'Secure my account')}
  `);
  await transporter.sendMail({ from: '"CloudDrive" <redmotiontr@gmail.com>', to, subject: 'New sign-in to your CloudDrive account', html });
}

export async function sendPasswordChangedEmail(to: string, displayName: string): Promise<void> {
  const time = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">Your password was changed</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">
      Hi <strong style="color:#111827;">${displayName}</strong>, your CloudDrive password was successfully changed on <strong style="color:#111827;">${time}</strong>.
    </p>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 28px;">
      If you made this change, no further action is required. If you did <strong>not</strong> change your password, your account may be compromised — please act immediately.
    </p>
    ${ctaButton(`${FRONTEND_URL}/forgot-password`, "It wasn't me — Reset my password")}
  `);
  await transporter.sendMail({ from: '"CloudDrive" <redmotiontr@gmail.com>', to, subject: 'Your CloudDrive password was changed', html });
}

export async function sendFolderSharedEmail(
  to: string,
  fromName: string,
  folderName: string,
  driveLink: string,
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">A folder was shared with you</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 8px;">
      <strong style="color:#111827;">${fromName}</strong> shared a folder with you on CloudDrive:
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
      <span style="font-size:32px;margin-right:12px;">📁</span>
      <strong style="color:#111827;font-size:15px;">${folderName}</strong>
    </div>
    ${ctaButton(driveLink, 'View in CloudDrive')}
  `);
  await transporter.sendMail({ from: '"CloudDrive" <redmotiontr@gmail.com>', to, subject: `${fromName} shared a folder with you on CloudDrive`, html });
}

interface PaymentRequestAdminParams {
  type: string;
  displayName: string;
  username: string;
  planName?: string;
  storageGB?: number;
  amount: number;
  currency: string;
  symbol: string;
  note?: string;
  adminUrl: string;
  createdAt: string;
}

export async function sendPaymentRequestAdminNotification(
  to: string,
  params: PaymentRequestAdminParams,
): Promise<void> {
  const { type, displayName, username, planName, storageGB, amount, currency, symbol, note, adminUrl, createdAt } = params;
  const isUpgrade = type === 'UPGRADE';
  const badgeColor = isUpgrade ? '#10b981' : '#f59e0b';
  const badgeLabel = isUpgrade ? 'UPGRADE' : 'DONATION';
  const time = new Date(createdAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">💰 New Payment Request</h2>
    <span style="display:inline-block;background:${badgeColor};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:24px;letter-spacing:0.5px;">${badgeLabel}</span>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:4px;margin:0 0 28px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:140px;border-bottom:1px solid #e5e7eb;">User</td>
        <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;">${displayName} (@${username})</td>
      </tr>
      ${isUpgrade && planName ? `
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:140px;border-bottom:1px solid #e5e7eb;">Plan</td>
        <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;">${planName}${storageGB ? ` · ${storageGB} GB` : ''}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:140px;border-bottom:1px solid #e5e7eb;">Amount</td>
        <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;">${symbol}${amount} ${currency}</td>
      </tr>
      ${note ? `
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:140px;border-bottom:1px solid #e5e7eb;">Note</td>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-style:italic;border-bottom:1px solid #e5e7eb;">${note}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:140px;">Submitted</td>
        <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;">${time}</td>
      </tr>
    </table>
    ${ctaButton(adminUrl, 'View in Admin Panel')}
  `);
  await transporter.sendMail({
    from: '"CloudDrive" <redmotiontr@gmail.com>',
    to,
    subject: `CloudDrive - New ${isUpgrade ? 'Upgrade' : 'Donation'} Request 💰`,
    html,
  });
}

export async function sendPaymentApprovedEmail(
  to: string,
  displayName: string,
  planName: string,
  storageGB: number,
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">🎉 Payment Approved!</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">
      Hi <strong style="color:#111827;">${displayName}</strong>, your payment has been approved and your plan has been activated.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 28px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#15803d;">Plan activated</p>
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;">${planName}</p>
      <p style="margin:0;font-size:14px;color:#6b7280;">${storageGB} GB storage · Effective immediately</p>
    </div>
    ${ctaButton(`${FRONTEND_URL}/drive`, 'Go to My Drive')}
    <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
      Your new storage limit is available right now. Enjoy CloudDrive!
    </p>
  `);
  await transporter.sendMail({
    from: '"CloudDrive" <redmotiontr@gmail.com>',
    to,
    subject: 'CloudDrive - Payment Approved! 🎉',
    html,
  });
}

export async function sendPaymentRejectedEmail(
  to: string,
  displayName: string,
  adminNote?: string,
): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">Payment Request Update</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">
      Hi <strong style="color:#111827;">${displayName}</strong>, unfortunately we were unable to verify your recent payment request.
    </p>
    ${adminNote ? `
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Admin note</p>
      <p style="margin:0;font-size:14px;color:#78350f;">${adminNote}</p>
    </div>` : ''}
    <p style="color:#6b7280;line-height:1.6;margin:0 0 28px;">
      If you believe this is a mistake or need assistance, please reply to this email.
    </p>
    ${ctaButton(`${FRONTEND_URL}/settings?tab=billing`, 'View Billing')}
  `);
  await transporter.sendMail({
    from: '"CloudDrive" <redmotiontr@gmail.com>',
    to,
    subject: 'CloudDrive - Payment Request Update',
    html,
  });
}

export async function sendStorageWarningEmail(
  to: string,
  displayName: string,
  percentage: number,
  usedFormatted: string,
  limitFormatted: string,
): Promise<void> {
  const isNearFull = percentage >= 95;
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">${isNearFull ? '🚨' : '⚠️'} Storage ${isNearFull ? 'almost full' : 'running low'}</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">
      Hi <strong style="color:#111827;">${displayName}</strong>, you're using <strong style="color:${isNearFull ? '#ef4444' : '#f59e0b'};">${percentage}%</strong> of your CloudDrive storage.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 28px;">
      <p style="margin:0 0 10px;font-size:13px;color:#6b7280;">Storage used</p>
      <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">${usedFormatted} <span style="font-size:14px;font-weight:400;color:#6b7280;">of ${limitFormatted}</span></p>
      <div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
        <div style="height:100%;width:${Math.min(percentage, 100)}%;background:${isNearFull ? '#ef4444' : '#f59e0b'};border-radius:999px;"></div>
      </div>
    </div>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
      ${isNearFull
        ? 'You\'re almost out of space. Delete files you no longer need or contact us to increase your limit.'
        : 'Consider cleaning up old files to free up space and keep things running smoothly.'}
    </p>
    ${ctaButton(`${FRONTEND_URL}/drive`, 'Manage my storage')}
  `);
  await transporter.sendMail({
    from: '"CloudDrive" <redmotiontr@gmail.com>',
    to,
    subject: `You're using ${percentage}% of your CloudDrive storage`,
    html,
  });
}

export async function sendReferralBonusEmail(to: string, displayName: string, referredName: string): Promise<void> {
  const html = emailWrapper(`
    <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">You earned 5 GB bonus storage! 🎉</h2>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">Hi <strong style="color:#111827;">${displayName}</strong>,</p>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">
      Great news! <strong style="color:#111827;">${referredName}</strong> just joined CloudDrive using your referral link.
      As a thank-you, you both received <strong style="color:#6366f1;">5 GB of free bonus storage</strong>!
    </p>
    <div style="background:#f0f0ff;border:1px solid #c7d2fe;border-radius:12px;padding:20px 24px;margin:0 0 28px;">
      <p style="color:#4338ca;font-size:14px;margin:0;font-weight:600;">+5 GB bonus storage added to your account</p>
    </div>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 28px;">
      Keep sharing your referral link to earn even more storage! Every friend you invite earns you both 5 GB.
    </p>
    ${ctaButton(`${FRONTEND_URL}/settings`, 'View my storage')}
  `);
  await transporter.sendMail({ from: '"CloudDrive" <redmotiontr@gmail.com>', to, subject: `${referredName} joined CloudDrive — you got 5 GB bonus!`, html });
}
