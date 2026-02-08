import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/sendEmail";

export const runtime = "nodejs";

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isValidEmail(value: string): boolean {
  // Practical validation; we don't need full RFC compliance.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  if (process.env.DISABLE_AUTH === "true" && process.env.ALLOW_DEV_EMAIL !== "true") {
    return NextResponse.json(
      {
        error:
          "Outbound email is disabled when DISABLE_AUTH=true. Set ALLOW_DEV_EMAIL=true to allow sending in this environment.",
      },
      { status: 403 }
    );
  }

  // Stricter rate limit for outbound email to avoid abuse.
  const limiter = rateLimit(`share-email:${auth.userId}`, { maxRequests: 10, windowSeconds: 60 });
  if (limiter.limited) {
    return limiter.response!;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const toRaw = formData.get("to");
  const subjectRaw = formData.get("subject");
  const messageRaw = formData.get("message");
  const filenameRaw = formData.get("filename");
  const fileRaw = formData.get("file");

  if (typeof toRaw !== "string" || !toRaw.trim()) {
    return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
  }

  const recipients = parseRecipients(toRaw);
  if (recipients.length === 0 || recipients.some((r) => !isValidEmail(r))) {
    return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
  }

  const subject = typeof subjectRaw === "string" && subjectRaw.trim().length > 0 ? subjectRaw.trim() : "Board pack";
  const message = typeof messageRaw === "string" ? messageRaw : "";
  const filename = typeof filenameRaw === "string" && filenameRaw.trim().length > 0 ? filenameRaw.trim() : "board-pack.pdf";

  if (!(fileRaw instanceof File)) {
    return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
  }

  if (fileRaw.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF attachments are supported" }, { status: 400 });
  }

  const maxBytes = 10 * 1024 * 1024;
  if (fileRaw.size > maxBytes) {
    return NextResponse.json({ error: "PDF is too large to email (max 10MB)" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await fileRaw.arrayBuffer());

    await sendEmail({
      to: recipients,
      subject,
      text: message || "Board pack attached.",
      attachments: [{ filename, content: buffer, contentType: "application/pdf" }],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send share email", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
