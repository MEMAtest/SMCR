export type SharePdfResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "canceled" | "failed" };

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.message.toLowerCase().includes("abort"))
  );
}

export async function sharePdfFile(input: {
  blob: Blob;
  filename: string;
  title: string;
  text?: string;
}): Promise<SharePdfResult> {
  if (typeof navigator === "undefined" || typeof File === "undefined") {
    return { ok: false, reason: "unsupported" };
  }

  const nav = navigator as Navigator & {
    share?: (data: unknown) => Promise<void>;
    canShare?: (data: unknown) => boolean;
  };

  if (!nav.share) {
    return { ok: false, reason: "unsupported" };
  }

  const file = new File([input.blob], input.filename, { type: "application/pdf" });
  const shareData = {
    title: input.title,
    text: input.text,
    files: [file],
  };

  if (nav.canShare && !nav.canShare({ files: [file] })) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    await nav.share(shareData);
    return { ok: true };
  } catch (error) {
    if (isAbortError(error)) {
      return { ok: false, reason: "canceled" };
    }
    return { ok: false, reason: "failed" };
  }
}

