import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { evaluateAlerts } from '../lib/alerts';
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
    if (a.name === TICK) void updateBadge();
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
      return onObserved((msg as { snapshot?: unknown }).snapshot);
    }
    if (type === 'openUsage') return openUsage();
  });

  void ensureAlarm();
});
