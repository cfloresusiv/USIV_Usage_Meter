import type { UsageSnapshot } from './model';

/** Datos ficticios, siempre etiquetados como Demo y guardados aparte. */
export function demoSnapshot(
  now: Date,
  labels = { session: 'Sesión actual', weekly: 'Esta semana', credit: 'Crédito incluido' },
): UsageSnapshot {
  const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
  return {
    version: 1,
    source: 'demo',
    observedAt: now.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    plan: 'Pro',
    quotas: [
      { id: 'demo-session', kind: 'session', label: labels.session, percent: 42, reset: { at: inHours(2.5), raw: null, approximate: false } },
      { id: 'demo-weekly', kind: 'weekly', label: labels.weekly, percent: 83, reset: { at: inHours(70), raw: null, approximate: false } },
    ],
    credits: [
      {
        id: 'demo-credit',
        label: labels.credit,
        percentUsed: 30,
        remaining: { amount: '70', currency: 'USD' },
        total: { amount: '100', currency: 'USD' },
        expiresRaw: null,
      },
    ],
    usageCredits: {
      balance: { amount: '5.00', currency: 'USD' },
      monthlyLimit: { spent: { amount: '12.50', currency: 'USD' }, limit: { amount: '40', currency: 'USD' } },
    },
    productShares: [
      { label: 'Claude Code', percent: 60 },
      { label: 'Chats', percent: 40 },
    ],
    coverage: 'complete',
    missing: [],
  };
}
