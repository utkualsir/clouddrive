import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'redmotiontr@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(to: string, token: string, displayName: string): Promise<void> {
  const resetLink = `http://localhost:5173/reset-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset</title>
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
              <h2 style="color:#111827;margin:0 0 16px;font-size:22px;">Password Reset Request</h2>
              <p style="color:#6b7280;line-height:1.6;margin:0 0 24px;">Hi <strong style="color:#111827;">${displayName}</strong>,</p>
              <p style="color:#6b7280;line-height:1.6;margin:0 0 32px;">
                We received a request to reset your CloudDrive password. Click the button below to create a new password. This link expires in <strong style="color:#111827;">1 hour</strong>.
              </p>
              <div style="text-align:center;margin:0 0 32px;">
                <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">Reset My Password</a>
              </div>
              <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 8px;">Or copy this link into your browser:</p>
              <p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;font-size:12px;color:#6366f1;word-break:break-all;margin:0 0 32px;">${resetLink}</p>
              <div style="border-top:1px solid #e5e7eb;padding-top:24px;">
                <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
                  If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">© 2024 CloudDrive. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    from: '"CloudDrive" <redmotiontr@gmail.com>',
    to,
    subject: 'CloudDrive - Password Reset Request',
    html,
  });
}
