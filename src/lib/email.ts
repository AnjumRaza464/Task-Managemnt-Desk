import "server-only";
import { APP_NAME } from "@/lib/constants";

/**
 * Transactional email via the Resend HTTP API (provisioned through the Vercel
 * Marketplace, which sets RESEND_API_KEY). Without a key, emails are logged to
 * the server console in development and skipped in production.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function isDeliverableEmail(address: string): boolean {
  return EMAIL_RE.test(address) && !/\.(local|test|invalid|example)$/i.test(address);
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`;
}

export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; reason?: string }> {
  if (!isDeliverableEmail(message.to)) return { sent: false, reason: "undeliverable address" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:dev] To: ${message.to}\n[email:dev] Subject: ${message.subject}\n${message.text}\n`);
      return { sent: false, reason: "no RESEND_API_KEY (logged in dev)" };
    }
    console.warn("RESEND_API_KEY is not set; email not sent:", message.subject);
    return { sent: false, reason: "no RESEND_API_KEY" };
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress(),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Email to ${message.to} failed (${res.status}): ${body.slice(0, 300)}`);
    return { sent: false, reason: `resend ${res.status}` };
  }
  return { sent: true };
}

/** Sends several emails, never throwing; failures are logged individually. */
export async function sendEmails(messages: EmailMessage[]): Promise<void> {
  await Promise.allSettled(
    messages.map((m) =>
      sendEmail(m).catch((error) => {
        console.error(`Email to ${m.to} threw`, error);
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type EmailTemplate = {
  /** Shown as the email heading and used for the subject. */
  heading: string;
  /** "Hi Name," line; omitted when empty. */
  greeting?: string;
  /** Paragraphs in order. */
  lines: string[];
  cta?: { label: string; url: string };
  /** Small print under the button. */
  footer?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Renders a simple, brand-colored HTML email plus a plain-text twin. */
export function renderEmail(t: EmailTemplate): { html: string; text: string } {
  const p = (content: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#3b2c38">${content}</p>`;
  const paragraphs = t.lines.map((l) => p(escapeHtml(l))).join("");
  const greeting = t.greeting ? p(escapeHtml(t.greeting)) : "";
  const cta = t.cta
    ? `<p style="margin:20px 0"><a href="${escapeHtml(t.cta.url)}" style="display:inline-block;background:#e11d8f;color:#fffaf5;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${escapeHtml(t.cta.label)}</a></p>` +
      `<p style="margin:0 0 12px;font-size:12px;color:#8a7686">Or copy this link: <a href="${escapeHtml(t.cta.url)}" style="color:#e11d8f">${escapeHtml(t.cta.url)}</a></p>`
    : "";
  const footer = t.footer ? `<p style="margin:16px 0 0;font-size:12px;color:#8a7686">${escapeHtml(t.footer)}</p>` : "";

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#fdf4f9;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">` +
    `<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #f0dbe8">` +
    `<tr><td style="padding:20px 28px;border-bottom:1px solid #f0dbe8;font-weight:700;font-size:16px;color:#130a12">${escapeHtml(APP_NAME)}</td></tr>` +
    `<tr><td style="padding:24px 28px"><h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#130a12">${escapeHtml(t.heading)}</h1>${greeting}${paragraphs}${cta}${footer}</td></tr>` +
    `</table>` +
    `<p style="margin:16px 0 0;font-size:12px;color:#8a7686">You receive these emails because notifications are enabled for your ${escapeHtml(APP_NAME)} account.</p>` +
    `</td></tr></table></body></html>`;

  const text = [
    t.heading,
    "",
    ...(t.greeting ? [t.greeting, ""] : []),
    ...t.lines,
    ...(t.cta ? ["", `${t.cta.label}: ${t.cta.url}`] : []),
    ...(t.footer ? ["", t.footer] : []),
  ].join("\n");

  return { html, text };
}
