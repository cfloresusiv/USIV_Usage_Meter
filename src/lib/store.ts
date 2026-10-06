import { browser } from 'wxt/browser';
import {
  type Alert,
  DEFAULT_SETTINGS,
  type PanelState,
  type Settings,
  type SourceKind,
  STORAGE_KEYS,
  type UsageSnapshot,
} from './model';
import { validateSnapshot } from './validate';
import type { Snapshots } from './view';

// Todo se guarda en storage.local (en este dispositivo). Nada se sincroniza
// ni se envía fuera del navegador.

const local = () => browser.storage.local;
const SOURCES: SourceKind[] = ['observed', 'manual', 'demo'];

export function sanitizeSettings(v: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(typeof v === 'object' && v ? v : {}) } as Settings;
  const thresholds = Array.isArray(s.thresholds)
    ? s.thresholds.filter((t) => Number.isFinite(t) && t > 0 && t <= 1000).slice(0, 5)
    : DEFAULT_SETTINGS.thresholds;
  return {
    panelEnabled: s.panelEnabled !== false,
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto',
    staleMinutes: Number.isFinite(s.staleMinutes) ? Math.min(Math.max(s.staleMinutes, 1), 1440) : 15,
    thresholds: thresholds.length ? thresholds : DEFAULT_SETTINGS.thresholds,
    activeSource: SOURCES.includes(s.activeSource) ? s.activeSource : 'observed',
    manualAlerts: s.manualAlerts === true,
  };
}

export async function getSettings(): Promise<Settings> {
  const r = await local().get(STORAGE_KEYS.settings);
  return sanitizeSettings(r[STORAGE_KEYS.settings]);
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = sanitizeSettings({ ...(await getSettings()), ...patch });
  await local().set({ [STORAGE_KEYS.settings]: next });
  return next;
}

export async function getSnapshots(): Promise<Snapshots> {
  const keys = SOURCES.map(STORAGE_KEYS.snap);
  const r = await local().get(keys);
  const out: Snapshots = {};
  for (const s of SOURCES) {
    const snap = validateSnapshot(r[STORAGE_KEYS.snap(s)]);
    if (snap && snap.source === s) out[s] = snap;
  }
  return out;
}

export async function saveSnapshot(s: UsageSnapshot): Promise<void> {
  await local().set({ [STORAGE_KEYS.snap(s.source)]: s });
}

export async function getPanelState(): Promise<PanelState> {
  const r = await local().get(STORAGE_KEYS.panel);
  const p = r[STORAGE_KEYS.panel] as Partial<PanelState> | undefined;
  return {
    x: typeof p?.x === 'number' ? p.x : null,
    y: typeof p?.y === 'number' ? p.y : null,
    minimized: p?.minimized === true,
  };
}

export async function setPanelState(p: PanelState): Promise<void> {
  await local().set({ [STORAGE_KEYS.panel]: p });
}

export async function getActiveAlerts(): Promise<Alert[]> {
  const r = await local().get(STORAGE_KEYS.alertsActive);
  const a = r[STORAGE_KEYS.alertsActive];
  return Array.isArray(a) ? (a as Alert[]).slice(-10) : [];
}

export async function dismissAlert(key: string): Promise<void> {
  const list = (await getActiveAlerts()).filter((a) => a.key !== key);
  await local().set({ [STORAGE_KEYS.alertsActive]: list });
}

/** Borra snapshots, alertas y posición. Conserva las preferencias. */
export async function clearData(): Promise<void> {
  await local().remove([
    ...SOURCES.map(STORAGE_KEYS.snap),
    STORAGE_KEYS.alertsFired,
    STORAGE_KEYS.alertsActive,
    STORAGE_KEYS.panel,
  ]);
  await patchSettings({ activeSource: 'observed' });
}

export async function exportData(): Promise<string> {
  const [settings, snapshots] = await Promise.all([getSettings(), getSnapshots()]);
  return JSON.stringify(
    {
      app: 'USIV Usage Meter',
      version: browser.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      note: 'Cifras agregadas observadas o ingresadas localmente. No incluye conversaciones ni credenciales.',
      settings,
      snapshots,
    },
    null,
    2,
  );
}
