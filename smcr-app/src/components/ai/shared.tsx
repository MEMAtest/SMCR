"use client";

import { ExternalLink } from "lucide-react";
import { Badge, Callout, VerifyBadge } from "@/components/ui";
import type { AiResult } from "@/lib/ai/client";
import { resolveSource } from "@/lib/ai/rulesContext";

export type AiFailure = Extract<AiResult<unknown>, { ok: false }>;

/** Friendly notice / error for a failed AI call. */
export function AiErrorNotice({ failure }: { failure: AiFailure }) {
  if (failure.code === "ai_not_configured") {
    return (
      <Callout tone="info" title="AI features are not set up on this server">
        An administrator can enable them by adding an <code className="rounded bg-white/10 px-1">ANTHROPIC_API_KEY</code> to the server
        environment (optionally <code className="rounded bg-white/10 px-1">ANTHROPIC_MODEL</code>). Everything else in SM&amp;CR Studio works
        without it.
      </Callout>
    );
  }
  if (failure.code === "rate_limited" || failure.code === "upstream_rate_limited") {
    return (
      <Callout tone="warn" title="Please wait a moment">
        {failure.error}
      </Callout>
    );
  }
  if (failure.code === "refused") {
    return (
      <Callout tone="warn" title="The AI declined this request">
        {failure.error}
      </Callout>
    );
  }
  return (
    <Callout tone="bad" title="The AI request did not complete">
      {failure.error}
    </Callout>
  );
}

/** Citation chip resolving a rules-pack source ID to a human label. */
export function SourceChip({ sourceId, note }: { sourceId: string; note?: string }) {
  const src = resolveSource(sourceId);
  if (!src) {
    return (
      <Badge tone="neutral" className="font-mono">
        {sourceId}
      </Badge>
    );
  }
  return (
    <span
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2 py-1 text-xs text-sand/90"
      title={note ? `${src.label}: ${note}` : src.label}
    >
      <span className="font-medium">{src.label}</span>
      {src.ref && <span className="text-sand/60">· {src.ref}</span>}
      {src.verify && <VerifyBadge />}
    </span>
  );
}

export function AiDisclaimer({ compact }: { compact?: boolean }) {
  return (
    <p className={compact ? "text-xs text-sand/60" : "text-sm text-sand/70"}>
      AI output is a draft to help you think, not legal advice. It may be wrong or incomplete — check it against the FCA Handbook.
      Accountability stays with the firm and the named senior manager.{" "}
      <a
        href="https://handbook.fca.org.uk/handbook/sysc24"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-emerald underline-offset-2 hover:underline"
      >
        FCA Handbook <ExternalLink className="size-3" aria-hidden />
      </a>
    </p>
  );
}
