"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyNewLead = notifyNewLead;
exports.notifyNewAdmin = notifyNewAdmin;
exports.notifyStudentAdmission = notifyStudentAdmission;
const twilio_1 = __importDefault(require("twilio"));
const nodemailer_1 = __importDefault(require("nodemailer"));
// ── WhatsApp (Twilio) ─────────────────────────────────────────────────────────
const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM;
function twilioConfigured() {
    return !!(SID && TOKEN && FROM && SID !== "your_account_sid_here" && TOKEN !== "your_auth_token_here");
}
function toWA(phone) {
    const digits = phone.replace(/\D/g, "");
    const normalized = digits.startsWith("91") && digits.length === 12 ? "+" + digits
        : digits.length === 10 ? "+91" + digits
            : "+" + digits;
    return "whatsapp:" + normalized;
}
async function sendWhatsApp(to, body) {
    if (!twilioConfigured())
        return;
    if (!to || to.replace(/\D/g, "").length < 10)
        return;
    try {
        const msg = await (0, twilio_1.default)(SID, TOKEN).messages.create({ from: FROM, to: toWA(to), body });
        console.log(`[NOTIFY] WhatsApp sent to ${to} — SID: ${msg.sid}`);
    }
    catch (err) {
        console.error(`[NOTIFY] WhatsApp FAILED to ${to}:`, err?.message);
    }
}
// ── Email (Gmail SMTP) ────────────────────────────────────────────────────────
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || `"Golwala College CRM" <${EMAIL_USER}>`;
function emailConfigured() {
    return !!(EMAIL_USER && EMAIL_PASS
        && EMAIL_USER !== "your_gmail@gmail.com"
        && EMAIL_PASS !== "your_gmail_app_password");
}
function getTransporter() {
    return nodemailer_1.default.createTransport({
        service: "gmail",
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
}
async function sendEmail(to, subject, html, attachments) {
    if (!emailConfigured()) {
        console.log(`[NOTIFY] Email not configured — skipping email to ${to}`);
        console.log(`[NOTIFY] Add EMAIL_USER and EMAIL_PASS in .env to enable email notifications`);
        return;
    }
    try {
        const mailOptions = { from: EMAIL_FROM, to, subject, html };
        if (attachments)
            mailOptions.attachments = attachments;
        await getTransporter().sendMail(mailOptions);
        console.log(`[NOTIFY] Email sent to ${to}`);
    }
    catch (err) {
        console.error(`[NOTIFY] Email FAILED to ${to}:`, err?.message);
    }
}
// ── Email templates ───────────────────────────────────────────────────────────
function newLeadEmailHTML(lead) {
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
function newAdminEmailHTML(newUser) {
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
async function notifyNewLead(lead, recipients) {
    if (recipients.length === 0) {
        console.log(`[NOTIFY] No recipients — skipping notification for lead: ${lead.fullName}`);
        return;
    }
    const subject = `🎓 New Lead — ${lead.fullName}${lead.program ? ` (${lead.program})` : ""}`;
    const html = newLeadEmailHTML(lead);
    const waMsg = [
        `🎓 *New Lead Alert — Golwala College*`,
        ``,
        `👤 *Name:* ${lead.fullName}`,
        `📞 *Phone:* ${lead.phone}`,
        lead.email ? `📧 *Email:* ${lead.email}` : null,
        lead.program ? `📚 *Program:* ${lead.program}` : null,
        lead.programLevel ? `🎯 *Level:* ${lead.programLevel}` : null,
        lead.city ? `📍 *City:* ${lead.city}` : null,
        lead.source ? `🔗 *Source:* ${lead.source}` : null,
        ``,
        `_Please follow up at the earliest._`,
    ].filter(Boolean).join("\n");
    for (const r of recipients) {
        // Email
        if (r.email)
            await sendEmail(r.email, subject, html);
        // WhatsApp (if Twilio configured)
        if (r.phone)
            await sendWhatsApp(r.phone, waMsg);
    }
}
async function notifyNewAdmin(newUser, superAdminPhone, superAdminEmail) {
    // Email to super admin
    if (superAdminEmail) {
        await sendEmail(superAdminEmail, `✅ New User Created — ${newUser.name}`, newAdminEmailHTML(newUser));
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
// ── Student Admission Email Templates ────────────────────────────────────────
function studentAdmissionConfirmationHTML(application) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #eee;">
      <div style="background:linear-gradient(135deg,#c0392b,#8e1a10);padding:24px;">
        <h2 style="color:#fff;margin:0;font-size:20px;">🎓 Application Submitted Successfully</h2>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">Golwala College - Student Admissions</p>
      </div>
      <div style="padding:28px;font-size:14px;color:#444;">
        <p style="margin:0 0 16px;">Dear <strong>${application.firstName} ${application.surname}</strong>,</p>
        <p style="margin:0 0 20px;line-height:1.6;">
          Thank you for your application!
        </p>
        
        <div style="background:#f8f9fa;border-left:4px solid #c0392b;padding:16px;margin:20px 0;border-radius:4px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#666;width:160px;">📋 Application Number</td>
              <td style="padding:6px 0;font-weight:700;color:#c0392b;font-size:16px;">${application.applicationNo}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;">👤 Name</td>
              <td style="padding:6px 0;font-weight:600;color:#222;">${application.firstName} ${application.surname}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;">📚 Stream</td>
              <td style="padding:6px 0;color:#222;">${application.stream}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#666;">📅 Date of Birth</td>
              <td style="padding:6px 0;color:#222;">${new Date(application.dob).toLocaleDateString('en-IN')}</td>
            </tr>
          </table>
        </div>

        <div style="background:#fff8f8;border:1px solid #ffe0e0;padding:16px;margin:20px 0;border-radius:6px;">
          <p style="margin:0 0 8px;font-weight:600;color:#c0392b;">📌 Important - Next Steps:</p>
          <p style="margin:8px 0;line-height:1.8;color:#444;">
            To complete the admission process, students are required to visit the College Office along with a hard copy of the <strong>University of Mumbai form</strong> and the <strong>College Application form</strong> (attached as PDF).
          </p>
          <ul style="margin:8px 0;padding-left:20px;color:#666;line-height:1.8;">
            <li>Please save your <strong>Application Number</strong> for future reference</li>
            <li>Print the attached PDF and bring it to the college office</li>
            <li>Bring all original documents for verification</li>
            <li>Our admissions team will guide you through the next steps</li>
          </ul>
        </div>

        <p style="margin:20px 0 0;line-height:1.6;color:#666;">
          If you have any questions, please contact our admissions office at 
          <a href="mailto:info@golwalacollege.edu.in" style="color:#c0392b;text-decoration:none;">info@golwalacollege.edu.in</a>
          or call <strong>+91 89768 39253</strong>
        </p>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:13px;color:#999;">
            Best regards,<br>
            <strong style="color:#666;">Admissions Team</strong><br>
            Laxmichand Golwala College of Commerce & Economics
          </p>
        </div>
      </div>
      <div style="padding:16px 28px;background:#f9f9f9;font-size:11px;color:#aaa;text-align:center;">
        This is an automated confirmation email. Please do not reply to this email.
      </div>
    </div>
  `;
}
function adminNewAdmissionHTML(application) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #eee;">
      <div style="background:linear-gradient(135deg,#c0392b,#8e1a10);padding:24px;">
        <h2 style="color:#fff;margin:0;font-size:20px;">🎓 New Student Admission Application</h2>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">Golwala College CRM</p>
      </div>
      <div style="padding:28px;font-size:14px;">
        <p style="margin:0 0 20px;color:#444;">A new student admission application has been submitted and requires review.</p>
        
        <div style="background:#f8f9fa;border-left:4px solid #c0392b;padding:16px;margin:20px 0;border-radius:4px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:8px 0;color:#666;width:160px;">📋 Application No.</td>
              <td style="padding:8px 0;font-weight:700;color:#c0392b;font-size:16px;">${application.applicationNo}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">👤 Student Name</td>
              <td style="padding:8px 0;font-weight:600;color:#222;">${application.firstName} ${application.surname}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">👨 Father's Name</td>
              <td style="padding:8px 0;color:#222;">${application.fatherName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">👩 Mother's Name</td>
              <td style="padding:8px 0;color:#222;">${application.motherName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">📧 Email</td>
              <td style="padding:8px 0;color:#222;">${application.studentEmail}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">📞 Student Mobile</td>
              <td style="padding:8px 0;color:#222;">${application.studentMobile}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">📞 Parent Mobile</td>
              <td style="padding:8px 0;color:#222;">${application.parentMobile}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">📚 Stream</td>
              <td style="padding:8px 0;color:#222;">${application.stream}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">📅 Date of Birth</td>
              <td style="padding:8px 0;color:#222;">${new Date(application.dob).toLocaleDateString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">⚧ Gender</td>
              <td style="padding:8px 0;color:#222;">${application.gender}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">🏷️ Category</td>
              <td style="padding:8px 0;color:#222;">${application.category}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;">📍 City</td>
              <td style="padding:8px 0;color:#222;">${application.city}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top:24px;">
          <a href="${process.env.ADMIN_URL || 'https://admin.golwalacollege.edu.in'}/student-applications" 
             style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#c0392b,#8e1a10);color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
            View Application in CRM →
          </a>
        </div>

        <div style="margin-top:24px;padding:16px;background:#fff8f8;border:1px solid #ffe0e0;border-radius:6px;">
          <p style="margin:0;font-size:13px;color:#c0392b;font-weight:600;">⏰ Action Required</p>
          <p style="margin:8px 0 0;font-size:13px;color:#666;">Please review this application and contact the student within 3-5 working days.</p>
        </div>
      </div>
      <div style="padding:16px 28px;background:#f9f9f9;font-size:11px;color:#aaa;text-align:center;">
        Golwala College CRM — Automated notification
      </div>
    </div>
  `;
}
async function notifyStudentAdmission(application, adminEmails, pdfBuffer) {
    // Send confirmation email to student with PDF attachment
    if (application.studentEmail && pdfBuffer) {
        const attachments = [
            {
                filename: `Application_${application.applicationNo}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ];
        await sendEmail(application.studentEmail, `🎓 Application Submitted - ${application.applicationNo}`, studentAdmissionConfirmationHTML({
            applicationNo: application.applicationNo,
            firstName: application.firstName,
            surname: application.surname,
            stream: application.stream,
            dob: application.dob,
        }), attachments);
    }
    // Skip admin notification for now (as per requirement)
    // Admin notifications will be added later
    console.log(`[NOTIFY] Student admission email sent to ${application.studentEmail} with PDF attachment`);
}
