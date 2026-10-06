import type { CreditPool, Money, ProductShare, Quota, ResetInfo, UsageSnapshot } from './model';

// Validación estricta de snapshots que llegan por mensajería o desde
// almacenamiento. Reconstruye el objeto con campos conocidos y longitudes
// acotadas: nada de la página pasa sin filtrar.

const MAX_TEXT = 120;
const MAX_ITEMS = 20;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown, max = MAX_TEXT): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
const iso = (v: unknown): string | null =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
const pct = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000 ? v : null;

function money(v: unknown): Money | null {
  if (!isObj(v)) return null;
  const amount = typeof v.amount === 'string' && /^\d{1,15}(\.\d{1,12})?$/.test(v.amount) ? v.amount : null;
  const currency = typeof v.currency === 'string' && /^([A-Z]{3}|[$€£])$/.test(v.currency) ? v.currency : null;
  return amount && currency ? { amount, currency } : null;
}

function reset(v: unknown): ResetInfo {
  if (!isObj(v)) return { at: null, raw: null, approximate: false };
  return { at: iso(v.at), raw: str(v.raw), approximate: v.approximate === true };
}

function quota(v: unknown): Quota | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 60);
  const label = str(v.label);
  const kind = v.kind === 'session' || v.kind === 'weekly' || v.kind === 'other' ? v.kind : null;
  if (!id || !label || !kind) return null;
  return { id, label, kind, percent: pct(v.percent), reset: reset(v.reset) };
}

function credit(v: unknown): CreditPool | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 60);
  const label = str(v.label);
  if (!id || !label) return null;
  return {
    id,
    label,
    percentUsed: pct(v.percentUsed),
    remaining: money(v.remaining),
    total: money(v.total),
    expiresRaw: str(v.expiresRaw),
  };
}

function share(v: unknown): ProductShare | null {
  if (!isObj(v)) return null;
  const label = str(v.label);
  const percent = pct(v.percent);
  return label && percent !== null ? { label, percent } : null;
}

const list = <T>(v: unknown, fn: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.slice(0, MAX_ITEMS).map(fn).filter((x): x is T => x !== null) : [];

export function validateSnapshot(v: unknown): UsageSnapshot | null {
  if (!isObj(v) || v.version !== 1) return null;
  const source = v.source === 'observed' || v.source === 'manual' || v.source === 'demo' ? v.source : null;
  const observedAt = iso(v.observedAt);
  if (!source || !observedAt) return null;
  const uc = isObj(v.usageCredits) ? v.usageCredits : null;
  const ml = uc && isObj(uc.monthlyLimit) ? uc.monthlyLimit : null;
  const spent = ml ? money(ml.spent) : null;
  const limit = ml ? money(ml.limit) : null;
  return {
    version: 1,
    source,
    observedAt,
    timeZone: str(v.timeZone, 64) ?? 'UTC',
    plan: str(v.plan, 40),
    quotas: list(v.quotas, quota),
    credits: list(v.credits, credit),
    usageCredits: uc
      ? { balance: money(uc.balance), monthlyLimit: spent && limit ? { spent, limit } : null }
      : null,
    productShares: list(v.productShares, share),
    coverage: v.coverage === 'complete' ? 'complete' : 'partial',
    missing: list(v.missing, (x) => str(x, 60)),
  };
}
