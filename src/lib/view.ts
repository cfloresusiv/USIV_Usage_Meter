import type { Settings, SourceKind, UsageSnapshot } from './model';

export type Snapshots = Partial<Record<SourceKind, UsageSnapshot>>;

export interface ActiveView {
  snapshot: UsageSnapshot | null;
  source: SourceKind;
  stale: boolean;
  /** Hay una observación más reciente que el dato manual activo. */
  newerObserved: boolean;
}

export function isStale(s: UsageSnapshot, staleMinutes: number, now: Date): boolean {
  if (s.source === 'demo') return false;
  return now.getTime() - new Date(s.observedAt).getTime() > staleMinutes * 60_000;
}

export function activeView(settings: Settings, snaps: Snapshots, now: Date): ActiveView {
  const source = settings.activeSource;
  const snapshot = snaps[source] ?? null;
  const observed = snaps.observed;
  return {
    snapshot,
    source,
    stale: snapshot ? isStale(snapshot, settings.staleMinutes, now) : false,
    newerObserved:
      source === 'manual' &&
      !!observed &&
      (!snapshot || observed.observedAt > snapshot.observedAt),
  };
}

/** Nivel de color para un porcentaje según los umbrales configurados. */
export function level(percent: number | null, thresholds: number[]): 'none' | 'ok' | 'warn' | 'crit' {
  if (percent === null) return 'none';
  const sorted = [...thresholds].sort((a, b) => a - b);
  const high = sorted[sorted.length - 1] ?? 100;
  const mid = sorted.length > 1 ? sorted[sorted.length - 2]! : high;
  if (percent >= high) return 'crit';
  if (percent >= mid) return 'warn';
  return 'ok';
}
