import { ratioPercent } from './amounts';
import type { Alert, Settings, UsageSnapshot } from './model';

// Una alerta por métrica, período y umbral. El período se identifica por la
// hora de reinicio (o el texto original) para que un nuevo ciclo vuelva a avisar.

interface Metric {
  metric: string;
  period: string;
  percent: number;
}

function metrics(s: UsageSnapshot): Metric[] {
  const out: Metric[] = [];
  for (const q of s.quotas) {
    if (q.percent === null) continue;
    out.push({ metric: q.label, period: q.reset.at ?? q.reset.raw ?? 'na', percent: q.percent });
  }
  for (const c of s.credits) {
    if (c.percentUsed === null) continue;
    out.push({ metric: c.label, period: c.expiresRaw ?? 'na', percent: c.percentUsed });
  }
  const ml = s.usageCredits?.monthlyLimit;
  if (ml) {
    const p = ratioPercent(ml.spent, ml.limit);
    if (p !== null) out.push({ metric: 'monthly-spend', period: s.observedAt.slice(0, 7), percent: p });
  }
  return out;
}

/**
 * Calcula alertas nuevas. Devuelve las alertas y el conjunto actualizado de
 * claves ya disparadas (persistido para deduplicar entre pestañas y reinicios).
 */
export function evaluateAlerts(
  s: UsageSnapshot,
  settings: Settings,
  fired: string[],
  now: Date,
): { alerts: Alert[]; fired: string[] } {
  if (s.source === 'demo') return { alerts: [], fired };
  if (s.source === 'manual' && !settings.manualAlerts) return { alerts: [], fired };
  const seen = new Set(fired);
  const alerts: Alert[] = [];
  for (const m of metrics(s)) {
    // Solo el umbral más alto alcanzado genera aviso; los menores se marcan como vistos.
    const reached = settings.thresholds.filter((t) => m.percent >= t).sort((a, b) => a - b);
    const top = reached[reached.length - 1];
    for (const t of reached) {
      const key = `${s.source}|${m.metric}|${m.period}|${t}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (t === top) {
        alerts.push({ key, metric: m.metric, threshold: t, percent: m.percent, createdAt: now.toISOString() });
      }
    }
  }
  return { alerts, fired: [...seen].slice(-300) };
}
