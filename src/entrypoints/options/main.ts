import { browser } from 'wxt/browser';
import '../../ui/theme.css';
import './style.css';
import { demoSnapshot } from '../../lib/demo';
import { localizeDocument, t } from '../../lib/i18n';
import { REPO_URL, type SourceKind, type UsageSnapshot, USIV_URL } from '../../lib/model';
import { clearData, exportData, getSettings, getSnapshots, patchSettings, saveSnapshot } from '../../lib/store';
import { applyTheme } from '../../ui/brand';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function flash(id: string, text: string): void {
  const n = $(id);
  n.textContent = text;
  setTimeout(() => (n.textContent = ''), 3000);
}

/** datetime-local (hora local) <-> ISO */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);
function pctOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
const field = <T extends HTMLElement>(form: string, name: string) =>
  $<HTMLFormElement>(form).elements.namedItem(name) as unknown as T;

async function load(): Promise<void> {
  const [settings, snaps] = await Promise.all([getSettings(), getSnapshots()]);
  applyTheme($('app'), settings.theme);

  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="source"]')) {
    r.checked = r.value === settings.activeSource;
  }

  field<HTMLInputElement>('prefs', 'panelEnabled').checked = settings.panelEnabled;
  field<HTMLSelectElement>('prefs', 'theme').value = settings.theme;
  field<HTMLInputElement>('prefs', 'staleMinutes').value = String(settings.staleMinutes);
  field<HTMLInputElement>('prefs', 'thresholds').value = settings.thresholds.join(', ');
  field<HTMLInputElement>('prefs', 'manualAlerts').checked = settings.manualAlerts;

  const m = snaps.manual;
  const session = m?.quotas.find((q) => q.kind === 'session');
  const weekly = m?.quotas.find((q) => q.kind === 'weekly');
  field<HTMLInputElement>('manual', 'plan').value = m?.plan ?? '';
  field<HTMLInputElement>('manual', 'session').value = session?.percent?.toString() ?? '';
  field<HTMLInputElement>('manual', 'sessionReset').value = toLocalInput(session?.reset.at);
  field<HTMLInputElement>('manual', 'weekly').value = weekly?.percent?.toString() ?? '';
  field<HTMLInputElement>('manual', 'weeklyReset').value = toLocalInput(weekly?.reset.at);
}

localizeDocument();
$<HTMLAnchorElement>('usivLink').href = USIV_URL;
$<HTMLAnchorElement>('repoLink').href = REPO_URL;
$('version').textContent = `v${browser.runtime.getManifest().version}`;

$('open').addEventListener('click', () => void browser.runtime.sendMessage({ type: 'openUsage' }));

$('sources').addEventListener('change', async (e) => {
  const source = (e.target as HTMLInputElement).value as SourceKind;
  if (source === 'demo') {
    await saveSnapshot(
      demoSnapshot(new Date(), { session: t('demoSession'), weekly: t('demoWeekly'), credit: t('demoCredit') }),
    );
  }
  await patchSettings({ activeSource: source });
});

$('manual').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target as HTMLFormElement);
  const now = new Date();
  const quota = (kind: 'session' | 'weekly', pct: string, reset: string) => ({
    id: `manual-${kind}`,
    kind,
    label: kind === 'session' ? t('demoSession') : t('demoWeekly'),
    percent: pctOrNull(fd.get(pct)),
    reset: { at: fromLocalInput(String(fd.get(reset) ?? '')), raw: null, approximate: false },
  });
  const snap: UsageSnapshot = {
    version: 1,
    source: 'manual',
    observedAt: now.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    plan: String(fd.get('plan') ?? '').trim().slice(0, 40) || null,
    quotas: [quota('session', 'session', 'sessionReset'), quota('weekly', 'weekly', 'weeklyReset')],
    credits: [],
    usageCredits: null,
    productShares: [],
    coverage: 'partial',
    missing: [],
  };
  await saveSnapshot(snap);
  await patchSettings({ activeSource: 'manual' });
  flash('manualMsg', t('saved'));
});

$('prefs').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target as HTMLFormElement);
  const thresholds = String(fd.get('thresholds') ?? '')
    .split(/[,;\s]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  await patchSettings({
    panelEnabled: fd.get('panelEnabled') === 'on',
    theme: fd.get('theme') as 'auto' | 'light' | 'dark',
    staleMinutes: Number(fd.get('staleMinutes')),
    thresholds,
    manualAlerts: fd.get('manualAlerts') === 'on',
  });
  flash('prefsMsg', t('saved'));
});

$('export').addEventListener('click', async () => {
  const blob = new Blob([await exportData()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `usiv-usage-meter-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// Confirmación en dos clics, sin diálogos modales.
let clearArmed = false;
$('clear').addEventListener('click', async () => {
  if (!clearArmed) {
    clearArmed = true;
    $('clear').textContent = t('clearConfirm');
    setTimeout(() => {
      clearArmed = false;
      $('clear').textContent = t('clearData');
    }, 4000);
    return;
  }
  clearArmed = false;
  await clearData();
  $('clear').textContent = t('clearData');
  flash('dataMsg', t('cleared'));
});

// Recargar solo ante cambios de preferencias o del dato manual, para no pisar lo que se está escribiendo.
browser.storage.onChanged.addListener((changes) => {
  if ('settings' in changes || 'snap:manual' in changes) void load();
});
void load();
