import nodemailer from "nodemailer";
import { Resend } from "resend";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type EmailProvider = "resend" | "ses" | "smtp";

function assertEmailSendingAllowed() {
  // When auth is disabled, treat the app as "public" and block outbound email unless explicitly allowed.
  // This prevents accidental mail-sender exposure in dev/staging.
  if (process.env.DISABLE_AUTH === "true" && process.env.ALLOW_DEV_EMAIL !== "true") {
    throw new Error(
      "Outbound email is disabled when DISABLE_AUTH=true. Set ALLOW_DEV_EMAIL=true to allow sending in this environment."
    );
  }
}

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("your-email") ||
    lower.includes("your-app-password") ||
    lower.includes("your-resend-api-key") ||
    lower.includes("example.com") ||
    lower.includes("noreply@yourdomain.com")
  );
}

function getFromAddress(): string | null {
  const candidates = [process.env.EMAIL_FROM, process.env.SES_FROM_EMAIL, process.env.FROM_EMAIL];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (looksLikePlaceholder(candidate)) continue;
    return candidate;
  }
  return null;
}

function hasResendConfig(): boolean {
  const key = process.env.RESEND_API_KEY;
  const from = getFromAddress();
  if (!key || !from) return false;
  if (looksLikePlaceholder(key) || looksLikePlaceholder(from)) return false;
  return true;
}

function hasSesConfig(): boolean {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SES_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || process.env.AWS_SES_REGION;
  const from = getFromAddress();

  if (!from) return false;
  if (!region) return false;
  if (!accessKeyId || !secretAccessKey) return false;
  if (looksLikePlaceholder(accessKeyId) || looksLikePlaceholder(secretAccessKey)) return false;
  if (region.toLowerCase().includes("your-region")) return false;
  return true;
}

function hasSmtpConfig(): boolean {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = process.env.EMAIL_SERVER_PORT;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = getFromAddress();

  if (!host || !port || !user || !pass || !from) return false;
  if ([host, user, pass, from].some(looksLikePlaceholder)) return false;
  return true;
}

function getEmailProviderSetting(): EmailProvider | "auto" {
  const raw = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === "auto") return "auto";
  if (raw === "resend" || raw === "ses" || raw === "smtp") return raw;
  throw new Error(`Unknown EMAIL_PROVIDER value: ${process.env.EMAIL_PROVIDER}`);
}

export function getConfiguredEmailProvider(): EmailProvider | null {
  const setting = getEmailProviderSetting();

  if (setting === "resend") return hasResendConfig() ? "resend" : null;
  if (setting === "ses") return hasSesConfig() ? "ses" : null;
  if (setting === "smtp") return hasSmtpConfig() ? "smtp" : null;

  if (hasResendConfig()) return "resend";
  if (hasSesConfig()) return "ses";
  if (hasSmtpConfig()) return "smtp";
  return null;
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}

/** Wrap base64 string at 76 chars per line (RFC 2045) */
function chunkBase64(b64: string): string {
  return b64.replace(/.{76}/g, "$&\r\n");
}

export function assertEmailConfigured() {
  if (getConfiguredEmailProvider()) return;
  throw new Error(
    "Email is not configured. Configure Resend (RESEND_API_KEY + EMAIL_FROM), Amazon SES (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY + AWS_REGION + EMAIL_FROM, or AWS_SES_ACCESS_KEY_ID/AWS_SES_SECRET_ACCESS_KEY + AWS_SES_REGION + EMAIL_FROM), or SMTP (EMAIL_SERVER_HOST/PORT/USER/PASSWORD + EMAIL_FROM)."
  );
}

async function sendWithSes(input: {
  to: string[];
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const region = process.env.AWS_REGION || process.env.AWS_SES_REGION || "eu-west-2";
  const from = getFromAddress();
  if (!from) throw new Error("Missing EMAIL_FROM (or SES_FROM_EMAIL/FROM_EMAIL) for SES sender.");

  const { SESClient, SendEmailCommand, SendRawEmailCommand } = await import("@aws-sdk/client-ses");

  const client = new SESClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SES_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SES_SECRET_ACCESS_KEY || "",
    },
  });

  const fromEmail = extractEmailAddress(from);

  if (input.attachments && input.attachments.length > 0) {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const rawParts: string[] = [];

    rawParts.push(`From: ${from}`);
    rawParts.push(`To: ${input.to.join(", ")}`);
    rawParts.push(`Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`);
    rawParts.push(`MIME-Version: 1.0`);
    rawParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    rawParts.push("");

    rawParts.push(`--${boundary}`);
    rawParts.push(`Content-Type: text/plain; charset=UTF-8`);
    rawParts.push(`Content-Transfer-Encoding: base64`);
    rawParts.push("");
    rawParts.push(chunkBase64(Buffer.from(input.text || "", "utf-8").toString("base64")));
    rawParts.push("");

    for (const att of input.attachments) {
      rawParts.push(`--${boundary}`);
      rawParts.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
      rawParts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      rawParts.push(`Content-Transfer-Encoding: base64`);
      rawParts.push("");
      rawParts.push(chunkBase64(att.content.toString("base64")));
      rawParts.push("");
    }

    rawParts.push(`--${boundary}--`);

    const rawMessage = rawParts.join("\r\n");

    await client.send(
      new SendRawEmailCommand({
        Source: fromEmail,
        Destinations: input.to,
        RawMessage: { Data: Buffer.from(rawMessage) },
      })
    );
    return;
  }

  await client.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: input.to },
      Message: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: input.text, Charset: "UTF-8" },
        },
      },
    })
  );
}

export async function sendEmail(input: {
  to: string[];
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  assertEmailSendingAllowed();
  assertEmailConfigured();

  const from = getFromAddress()!;

  const provider = getConfiguredEmailProvider();
  if (!provider) {
    // Should be unreachable due to assertEmailConfigured() but keep this defensively.
    throw new Error("Email is not configured.");
  }

  if (provider === "resend") {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
    return;
  }

  if (provider === "ses") {
    try {
      await sendWithSes(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SES error";
      throw new Error(
        message.includes("AccessDenied")
          ? `Amazon SES permission error (need ses:SendRawEmail for PDF attachments): ${message}`
          : `Amazon SES error: ${message}`
      );
    }
    return;
  }

  const host = process.env.EMAIL_SERVER_HOST!;
  const port = Number(process.env.EMAIL_SERVER_PORT);
  const user = process.env.EMAIL_SERVER_USER!;
  const pass = process.env.EMAIL_SERVER_PASSWORD!;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: input.to.join(", "),
    subject: input.subject,
    text: input.text,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}
