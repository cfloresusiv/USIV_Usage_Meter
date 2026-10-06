import type { Quota, QuotaKind, UsageSnapshot } from './model';

// Lectura en vivo: la misma API JSON que consume la vista de uso de claude.ai.
// Solo se toman porcentajes y horas de reinicio; el resto del snapshot (plan,
// créditos, reparto por producto) se conserva de la última lectura de la página.

export const API_BASE = 'https://claude.ai/api';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Organización con chat (la cuenta personal); null si la respuesta no es la esperada. */
export function pickOrgId(orgs: unknown): string | null {
  if (!Array.isArray(orgs)) return null;
  const valid = orgs.filter((o) => isObj(o) && typeof o.uuid === 'string' && UUID_RE.test(o.uuid));
  const chat = valid.find((o) => Array.isArray(o.capabilities) && o.capabilities.includes('chat'));
  return ((chat ?? valid[0])?.uuid as string | undefined) ?? null;
}

const FIELD: Partial<Record<QuotaKind, string>> = { session: 'five_hour', weekly: 'seven_day' };

function liveQuota(q: Quota, api: Record<string, unknown>): Quota {
  const field = FIELD[q.kind];
  const v = field ? api[field] : null;
  if (!isObj(v) || typeof v.utilization !== 'number' || !Number.isFinite(v.utilization)) return q;
  const percent = Math.min(Math.max(v.utilization, 0), 1000);
  const t = typeof v.resets_at === 'string' ? Date.parse(v.resets_at) : NaN;
  // Redondeo al minuto: la API agrega fracciones de segundo variables y la
  // hora de reinicio identifica el periodo de las alertas.
  const reset = Number.isNaN(t)
    ? q.reset
    : { at: new Date(Math.round(t / 60_000) * 60_000).toISOString(), raw: null, approximate: false };
  return { ...q, percent, reset };
}

/**
 * Aplica la respuesta de `/organizations/{id}/usage` sobre el último snapshot
 * observado. Devuelve null si la respuesta no trae ninguna cuota reconocible.
 */
export function applyLiveUsage(base: UsageSnapshot, api: unknown, now: Date): UsageSnapshot | null {
  if (!isObj(api)) return null;
  const used = new Set<QuotaKind>();
  const quotas = base.quotas.map((q) => {
    // Solo la primera cuota de cada tipo (las semanales por modelo no vienen aquí).
    if (used.has(q.kind)) return q;
    used.add(q.kind);
    return liveQuota(q, api);
  });
  if (quotas.every((q, i) => q === base.quotas[i])) return null;
  return { ...base, observedAt: now.toISOString(), quotas };
}
