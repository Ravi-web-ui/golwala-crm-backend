import twilio from "twilio";
import nodemailer from "nodemailer";

// ── WhatsApp (Twilio) ─────────────────────────────────────────────────────────
const SID   = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM  = process.env.TWILIO_WHATSAPP_FROM;

function twilioConfigured(): boolean {
  return !!(SID && TOKEN && FROM && SID !== "your_account_sid_here" && TOKEN !== "your_auth_token_here");
}

function toWA(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.startsWith("91") && digits.length === 12 ? "+" + digits
    : digits.length === 10 ? "+91" + digits
    : "+" + digits;
  return "whatsapp:" + normalized;
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  if (!twilioConfigured()) return;
  if (!to || to.replace(/\D/g, "").length < 10) return;
  try {
    const msg = await twilio(SID!, TOKEN!).messages.create({ from: FROM!, to: toWA(to), body });
    console.log(`[NOTIFY] WhatsApp sent to ${to} — SID: ${msg.sid}`);
  } catch (err: any) {
    console.error(`[NOTIFY] WhatsApp FAILED to ${to}:`, err?.message);
  }
}

// ── Email (Gmail SMTP) ────────────────────────────────────────────────────────
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || `"Golwala College CRM" <${EMAIL_USER}>`;

function emailConfigured(): boolean {
  return !!(EMAIL_USER && EMAIL_PASS
    && EMAIL_USER !== "your_gmail@gmail.com"
    && EMAIL_PASS !== "your_gmail_app_password");
}

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER!, pass: EMAIL_PASS! },
  });
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!emailConfigured()) {
    console.log(`[NOTIFY] Email not configured — skipping email to ${to}`);
    console.log(`[NOTIFY] Add EMAIL_USER and EMAIL_PASS in .env to enable email notifications`);
    return;
  }
  try {
    await getTransporter().sendMail({ from: EMAIL_FROM, to, subject, html });
    console.log(`[NOTIFY] Email sent to ${to}`);
  } catch (err: any) {
    console.error(`[NOTIFY] Email FAILED to ${to}:`, err?.message);
  }
}

// ── Email templates ───────────────────────────────────────────────────────────
function newLeadEmailHTML(lead: {
  fullName: string; phone: string; email?: string;
  program?: string | null; programLevel?: string | null;
  city?: string | null; source?: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #eee;">
      <div style="background:linear-gradient(135deg,#c0392b,#8e1a10);padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">🎓 New Lead Alert</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Golwala College CRM</p>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#888;width:130px;">👤 Name</td><td style="padding:8px 0;font-weight:600;color:#222;">${lead.fullName}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">📞 Phone</td><td style="padding:8px 0;color:#222;">${lead.phone}</td></tr>
          ${lead.email ? `<tr><td style="padding:8px 0;color:#888;">📧 Email</td><td style="padding:8px 0;color:#222;">${lead.email}</td></tr>` : ""}
          ${lead.program ? `<tr><td style="padding:8px 0;color:#888;">📚 Program</td><td style="padding:8px 0;color:#222;">${lead.program}</td></tr>` : ""}
          ${lead.programLevel ? `<tr><td style="padding:8px 0;color:#888;">🎯 Level</td><td style="padding:8px 0;color:#222;">${lead.programLevel}</td></tr>` : ""}
          ${lead.city ? `<tr><td style="padding:8px 0;color:#888;">📍 City</td><td style="padding:8px 0;color:#222;">${lead.city}</td></tr>` : ""}
          ${lead.source ? `<tr><td style="padding:8px 0;color:#888;">🔗 Source</td><td style="padding:8px 0;color:#222;">${lead.source}</td></tr>` : ""}
        </table>
        <div style="margin-top:20px;padding:14px;background:#fff8f8;border-left:3px solid #c0392b;border-radius:4px;font-size:13px;color:#666;">
          Please follow up at the earliest.
        </div>
        <div style="margin-top:20px;">
          <a href="${process.env.ADMIN_URL || "#"}" style="display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#c0392b,#8e1a10);color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
            Open CRM →
          </a>
        </div>
      </div>
      <div style="padding:14px 24px;background:#f9f9f9;font-size:11px;color:#aaa;text-align:center;">
        Golwala College CRM &mdash; Automated notification
      </div>
    </div>
  `;
}

function newAdminEmailHTML(newUser: { name: string; email: string; role: string; phone?: string | null }): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #eee;">
      <div style="background:linear-gradient(135deg,#c0392b,#8e1a10);padding:20px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">✅ New User Created</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Golwala College CRM</p>
      </div>
      <div style="padding:24px;font-size:14px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#888;width:130px;">👤 Name</td><td style="padding:8px 0;font-weight:600;color:#222;">${newUser.name}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">📧 Email</td><td style="padding:8px 0;color:#222;">${newUser.email}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">🔑 Role</td><td style="padding:8px 0;color:#222;text-transform:capitalize;">${newUser.role.replace("_", " ")}</td></tr>
          ${newUser.phone ? `<tr><td style="padding:8px 0;color:#888;">📞 Phone</td><td style="padding:8px 0;color:#222;">${newUser.phone}</td></tr>` : ""}
        </table>
        <div style="margin-top:20px;">
          <a href="${process.env.ADMIN_URL || "#"}" style="display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#c0392b,#8e1a10);color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
            Login to CRM →
          </a>
        </div>
      </div>
    </div>
  `;
}

// ── Public functions ──────────────────────────────────────────────────────────

export async function notifyNewLead(lead: {
  fullName: string; phone: string; email?: string;
  program?: string | null; programLevel?: string | null;
  city?: string | null; source?: string;
}, recipients: { name: string; phone: string | null; email?: string | null }[]): Promise<void> {

  if (recipients.length === 0) {
    console.log(`[NOTIFY] No recipients — skipping notification for lead: ${lead.fullName}`);
    return;
  }

  const subject = `🎓 New Lead — ${lead.fullName}${lead.program ? ` (${lead.program})` : ""}`;
  const html    = newLeadEmailHTML(lead);

  const waMsg = [
    `🎓 *New Lead Alert — Golwala College*`,
    ``,
    `👤 *Name:* ${lead.fullName}`,
    `📞 *Phone:* ${lead.phone}`,
    lead.email        ? `📧 *Email:* ${lead.email}`        : null,
    lead.program      ? `📚 *Program:* ${lead.program}`    : null,
    lead.programLevel ? `🎯 *Level:* ${lead.programLevel}` : null,
    lead.city         ? `📍 *City:* ${lead.city}`          : null,
    lead.source       ? `🔗 *Source:* ${lead.source}`      : null,
    ``,
    `_Please follow up at the earliest._`,
  ].filter(Boolean).join("\n");

  for (const r of recipients) {
    // Email
    if (r.email) await sendEmail(r.email, subject, html);
    // WhatsApp (if Twilio configured)
    if (r.phone) await sendWhatsApp(r.phone, waMsg);
  }
}

export async function notifyNewAdmin(newUser: {
  name: string; email: string; role: string; phone?: string | null;
}, superAdminPhone: string | null, superAdminEmail: string | null): Promise<void> {
  // Email to super admin
  if (superAdminEmail) {
    await sendEmail(
      superAdminEmail,
      `✅ New User Created — ${newUser.name}`,
      newAdminEmailHTML(newUser)
    );
  }
  // WhatsApp to super admin
  if (superAdminPhone) {
    const msg = [
      `✅ *New User Created — Golwala CRM*`,
      ``,
      `👤 *Name:* ${newUser.name}`,
      `📧 *Email:* ${newUser.email}`,
      `🔑 *Role:* ${newUser.role.replace("_", " ")}`,
      newUser.phone ? `📞 *Phone:* ${newUser.phone}` : null,
      ``,
      `_Login at: ${process.env.ADMIN_URL}_`,
    ].filter(Boolean).join("\n");
    await sendWhatsApp(superAdminPhone, msg);
  }
  // Welcome email to the new user
  if (newUser.email) {
    const welcomeHtml = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #eee;">
        <div style="background:linear-gradient(135deg,#c0392b,#8e1a10);padding:20px 24px;">
          <h2 style="color:#fff;margin:0;font-size:18px;">👋 Welcome to Golwala CRM!</h2>
        </div>
        <div style="padding:24px;font-size:14px;color:#444;">
          <p>Hi <strong>${newUser.name}</strong>,</p>
          <p>Your CRM account has been created.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 0;color:#888;width:100px;">Email</td><td style="padding:6px 0;font-weight:600;">${newUser.email}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Role</td><td style="padding:6px 0;text-transform:capitalize;">${newUser.role.replace("_", " ")}</td></tr>
          </table>
          <a href="${process.env.ADMIN_URL || "#"}" style="display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#c0392b,#8e1a10);color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
            Login Now →
          </a>
          <p style="margin-top:16px;font-size:12px;color:#aaa;">Please change your password after first login.</p>
        </div>
      </div>
    `;
    await sendEmail(newUser.email, `👋 Welcome to Golwala College CRM`, welcomeHtml);
  }
}
