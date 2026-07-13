import nodemailer from "nodemailer";

// SMTP is optional. When it is not configured we fall back to logging the link
// so password reset is fully testable in development without an email provider.
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || "587", 10),
    secure: parseInt(SMTP_PORT || "587", 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const transport = getTransport();
  if (!transport) {
    console.warn(`[email] SMTP not configured — password reset link for ${to}: ${resetUrl}`);
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  await transport.sendMail({
    from,
    to,
    subject: "Reset your password",
    text: `You requested a password reset. Open this link to choose a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A1A2E">
        <h2 style="margin:0 0 12px">Reset your password</h2>
        <p style="color:#5b6172;line-height:1.5">You requested a password reset. Click the button below to choose a new password. This link is valid for 1 hour.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#6C4EF5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;display:inline-block">Choose a new password</a>
        </p>
        <p style="color:#8A8FA3;font-size:13px;line-height:1.5">If the button does not work, paste this link into your browser:<br>${resetUrl}</p>
        <p style="color:#8A8FA3;font-size:13px;line-height:1.5">If you did not request this, you can safely ignore this email.</p>
      </div>`,
  });
}
