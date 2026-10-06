import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { evaluateAlerts } from '../lib/alerts';
import { API_BASE, applyLiveUsage, pickOrgId } from '../lib/live';
import { type Alert, STORAGE_KEYS, USAGE_URL } from '../lib/model';
import { getActiveAlerts, getSettings, getSnapshots, saveSnapshot } from '../lib/store';
import { validateSnapshot } from '../lib/validate';
import { activeView, level } from '../lib/view';

// Service worker (Chrome) / event page (Firefox). Sin estado en memoria:
// todo se lee de storage en cada evento, para sobrevivir a la suspensión.

const TICK = 'usiv-tick';
const BADGE_COLORS = { ok: '#0E7FA0', warn: '#B7791F', crit: '#C53030', none: '#6B7280' } as const;

async function ensureAlarm(): Promise<void> {
  if (!(await browser.alarms.get(TICK))) {
    await browser.alarms.create(TICK, { periodInMinutes: 1 });
  }
}

async function updateBadge(): Promise<void> {
  const [settings, snaps] = await Promise.all([getSettings(), getSnapshots()]);
  const view = activeView(settings, snaps, new Date());
  const q = view.snapshot?.quotas.find((x) => x.kind === 'session') ?? view.snapshot?.quotas[0];
  const p = q?.percent ?? null;
  const text = p === null ? '' : `${Math.round(p)}%`;
  const color = view.stale ? BADGE_COLORS.none : BADGE_COLORS[level(p, settings.thresholds)];
  await browser.action.setBadgeText({ text });
  await browser.action.setBadgeBackgroundColor({ color });
  if ('setBadgeTextColor' in browser.action) {
    await browser.action.setBadgeTextColor({ color: '#FFFFFF' }).catch(() => {});
  }
}

async function onObserved(raw: unknown): Promise<void> {
  const snap = validateSnapshot(raw);
  if (!snap || snap.source !== 'observed') return;
  await saveSnapshot(snap);
  const settings = await getSettings();
  const r = await browser.storage.local.get(STORAGE_KEYS.alertsFired);
  const fired = Array.isArray(r[STORAGE_KEYS.alertsFired]) ? (r[STORAGE_KEYS.alertsFired] as string[]) : [];
  const { alerts, fired: nextFired } = evaluateAlerts(snap, settings, fired, new Date());
  const active: Alert[] = [...(await getActiveAlerts()), ...alerts].slice(-10);
  await browser.storage.local.set({
    [STORAGE_KEYS.alertsFired]: nextFired,
    ...(alerts.length && { [STORAGE_KEYS.alertsActive]: active }),
  });
}

// Lectura en vivo cada minuto desde la API que usa la propia vista de uso, con
// la sesión del navegador. Requiere una lectura previa de la página como base.
async function fetchJson(path: string): Promise<unknown> {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function liveRefresh(): Promise<void> {
  const settings = await getSettings();
  if (settings.autoRefreshMinutes <= 0 || settings.activeSource !== 'observed') return;
  const { observed } = await getSnapshots();
  if (!observed) return;
  const r = await browser.storage.local.get(STORAGE_KEYS.liveOrg);
  let org = typeof r[STORAGE_KEYS.liveOrg] === 'string' ? (r[STORAGE_KEYS.liveOrg] as string) : null;
  try {
    if (!org) {
      org = pickOrgId(await fetchJson('/organizations'));
      if (!org) return;
      await browser.storage.local.set({ [STORAGE_KEYS.liveOrg]: org });
    }
    const snap = applyLiveUsage(observed, await fetchJson(`/organizations/${org}/usage`), new Date());
    if (snap) await onObserved(snap);
  } catch {
    // Sesión cerrada o cuenta cambiada: se vuelve a resolver la organización.
    await browser.storage.local.remove(STORAGE_KEYS.liveOrg);
  }
}

// Respaldo si la lectura en vivo falla: abre la vista de uso en una pestaña inactiva para que el
// content script la lea con el mismo lector acotado, y la cierra al terminar.
const REFRESH_TIMEOUT_MS = 90_000;
const REFRESH_PARTIAL_MS = 20_000;

interface RefreshState {
  tabId: number | null;
  startedAt: number;
}

async function getRefreshState(): Promise<RefreshState | null> {
  const r = await browser.storage.local.get(STORAGE_KEYS.refresh);
  const v = r[STORAGE_KEYS.refresh] as Partial<RefreshState> | undefined;
  if (typeof v?.startedAt !== 'number') return null;
  return { tabId: typeof v.tabId === 'number' ? v.tabId : null, startedAt: v.startedAt };
}

async function finishRefresh(state: RefreshState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.refresh]: { tabId: null, startedAt: state.startedAt } });
  if (state.tabId !== null) await browser.tabs.remove(state.tabId).catch(() => {});
}

async function autoRefresh(): Promise<void> {
  const state = await getRefreshState();
  const now = Date.now();
  if (state?.tabId != null) {
    if (now - state.startedAt > REFRESH_TIMEOUT_MS) await finishRefresh(state);
    return;
  }
  const settings = await getSettings();
  if (settings.autoRefreshMinutes <= 0 || settings.activeSource !== 'observed') return;
  const interval = settings.autoRefreshMinutes * 60_000;
  // Reintentos espaciados aunque la lectura falle (p. ej. sesión cerrada).
  if (state && now - state.startedAt < interval) return;
  const { observed } = await getSnapshots();
  // Sin una lectura previa no se fuerza la apertura (el usuario aún no inició sesión).
  if (!observed || now - new Date(observed.observedAt).getTime() < interval) return;
  try {
    const tab = await browser.tabs.create({ url: USAGE_URL, active: false });
    await browser.storage.local.set({ [STORAGE_KEYS.refresh]: { tabId: tab.id ?? null, startedAt: now } });
  } catch {
    await browser.storage.local.set({ [STORAGE_KEYS.refresh]: { tabId: null, startedAt: now } });
  }
}

/** Cierra la pestaña de refresco cuando ya entregó una lectura. */
async function onRefreshObserved(tabId: number | undefined, coverage: unknown): Promise<void> {
  const state = await getRefreshState();
  if (!state || state.tabId === null || state.tabId !== tabId) return;
  if (coverage === 'complete' || Date.now() - state.startedAt > REFRESH_PARTIAL_MS) await finishRefresh(state);
}

async function openUsage(): Promise<void> {
  await browser.tabs.create({ url: USAGE_URL });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await ensureAlarm();
    await updateBadge();
    if (reason === 'install') await browser.runtime.openOptionsPage();
  });
  browser.runtime.onStartup.addListener(async () => {
    await ensureAlarm();
    await updateBadge();
  });

  browser.alarms.onAlarm.addListener((a) => {
    if (a.name === TICK) {
      void updateBadge();
      // Primero en vivo; el respaldo por pestaña solo actúa si el dato quedó viejo.
      void liveRefresh().then(autoRefresh);
    }
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (Object.keys(changes).some((k) => k.startsWith('snap:') || k === STORAGE_KEYS.settings)) void updateBadge();
  });

  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    // Solo mensajes de esta extensión (content script o páginas propias).
    if (sender.id !== browser.runtime.id || typeof msg !== 'object' || msg === null) return;
    const type = (msg as { type?: unknown }).type;
    if (type === 'observed') {
      if (!(sender.url ?? sender.tab?.url ?? '').startsWith('https://claude.ai/')) return;
      const snapshot = (msg as { snapshot?: unknown }).snapshot;
      return onObserved(snapshot).then(() =>
        onRefreshObserved(sender.tab?.id, (snapshot as { coverage?: unknown } | null)?.coverage),
      );
    }
    if (type === 'openUsage') return openUsage();
  });

  void ensureAlarm();
});
