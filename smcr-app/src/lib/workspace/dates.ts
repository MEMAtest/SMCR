/** Date helpers working in whole days on ISO yyyy-mm-dd strings (UTC). */

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)!;
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso)!;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toISODate(d);
}

/** Adds business days, skipping weekends (UK bank holidays not modelled). */
export function addBusinessDays(iso: string, days: number): string {
  const d = parseISODate(iso)!;
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return toISODate(d);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO)!;
  const b = parseISODate(toISO)!;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function formatDate(iso: string | undefined | null): string {
  const d = parseISODate(iso);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
