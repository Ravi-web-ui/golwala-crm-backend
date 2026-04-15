import twilio from "twilio";

const SID  = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM  = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886

function isConfigured(): boolean {
  return !!(SID && TOKEN && FROM && SID !== "your_account_sid_here");
}

function client() {
  return twilio(SID!, TOKEN!);
}

function toWA(phone: string): string {
  // Normalize: strip non-digits, ensure country code
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("91") && digits.length === 12
    ? "+" + digits
    : digits.length === 10
    ? "+91" + digits
    : "+" + digits;
  return "whatsapp:" + normalized;
}

async function send(to: string, body: string): Promise<void> {
  if (!isConfigured()) {
    console.log(`[NOTIFY] WhatsApp not configured. Would send to ${to}:\n${body}`);
    return;
  }
  try {
    await client().messages.create({ from: FROM!, to: toWA(to), body });
    console.log(`[NOTIFY] WhatsApp sent to ${to}`);
  } catch (err: any) {
    console.error(`[NOTIFY] WhatsApp failed to ${to}:`, err?.message);
  }
}

// ── Notification types ────────────────────────────────────────────────────────

export async function notifyNewLead(lead: {
  fullName: string;
  phone: string;
  email?: string;
  program?: string | null;
  programLevel?: string | null;
  city?: string | null;
  source?: string;
}, recipients: { name: string; phone: string | null }[]): Promise<void> {
  const msg = [
    `🎓 *New Lead Alert — Golwala College*`,
    ``,
    `👤 *Name:* ${lead.fullName}`,
    `📞 *Phone:* ${lead.phone}`,
    lead.email    ? `📧 *Email:* ${lead.email}`        : null,
    lead.program  ? `📚 *Program:* ${lead.program}`    : null,
    lead.programLevel ? `🎯 *Level:* ${lead.programLevel}` : null,
    lead.city     ? `📍 *City:* ${lead.city}`          : null,
    lead.source   ? `🔗 *Source:* ${lead.source}`      : null,
    ``,
    `_Please follow up at the earliest._`,
  ].filter(l => l !== null).join("\n");

  for (const r of recipients) {
    if (r.phone) await send(r.phone, msg);
  }
}

export async function notifyNewAdmin(newUser: {
  name: string;
  email: string;
  role: string;
  phone?: string | null;
}, superAdminPhone: string | null): Promise<void> {
  // Notify super admin
  if (superAdminPhone) {
    const adminMsg = [
      `✅ *New User Created — Golwala CRM*`,
      ``,
      `👤 *Name:* ${newUser.name}`,
      `📧 *Email:* ${newUser.email}`,
      `🔑 *Role:* ${newUser.role.replace("_", " ")}`,
      newUser.phone ? `📞 *Phone:* ${newUser.phone}` : null,
      ``,
      `_Login at: ${process.env.ADMIN_URL}_`,
    ].filter(l => l !== null).join("\n");
    await send(superAdminPhone, adminMsg);
  }

  // Notify the new user themselves
  if (newUser.phone) {
    const userMsg = [
      `👋 *Welcome to Golwala College CRM!*`,
      ``,
      `Hi ${newUser.name}, your account has been created.`,
      ``,
      `📧 *Email:* ${newUser.email}`,
      `🔑 *Role:* ${newUser.role.replace("_", " ")}`,
      ``,
      `Login here: ${process.env.ADMIN_URL}`,
      `_Please change your password after first login._`,
    ].join("\n");
    await send(newUser.phone, userMsg);
  }
}
