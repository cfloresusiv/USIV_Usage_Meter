import { browser } from 'wxt/browser';
import '../../ui/theme.css';
import './style.css';
import { localizeDocument, t } from '../../lib/i18n';
import { dismissAlert, getActiveAlerts, getSettings, getSnapshots, patchSettings } from '../../lib/store';
import { activeView } from '../../lib/view';
import { applyTheme, brandFooter } from '../../ui/brand';
import { renderSummary } from '../../ui/summary';

const CLAUDE_ORIGINS = { origins: ['https://claude.ai/*'] };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function render(): Promise<void> {
  const [settings, snaps, alerts] = await Promise.all([getSettings(), getSnapshots(), getActiveAlerts()]);
  applyTheme($('app'), settings.theme);
  const view = activeView(settings, snaps, new Date());
  $('summary').replaceChildren(
    renderSummary(view, settings, alerts, {
      openUsage: () => void browser.runtime.sendMessage({ type: 'openUsage' }).then(() => window.close()),
      useObserved: () => void patchSettings({ activeSource: 'observed' }),
      dismissAlert: (key) => void dismissAlert(key),
    }),
  );
  $('toggle').textContent = settings.panelEnabled ? t('hidePanel') : t('showPanel');
  $('perm').hidden = await browser.permissions.contains(CLAUDE_ORIGINS);
}

localizeDocument();
$('foot').append(brandFooter());
$('open').addEventListener('click', () => {
  void browser.runtime.sendMessage({ type: 'openUsage' }).then(() => window.close());
});
$('options').addEventListener('click', () => {
  void browser.runtime.openOptionsPage().then(() => window.close());
});
$('toggle').addEventListener('click', async () => {
  const s = await getSettings();
  await patchSettings({ panelEnabled: !s.panelEnabled });
});
$('grant').addEventListener('click', () => {
  // Debe ejecutarse directamente en el gesto del usuario (Firefox lo exige).
  void browser.permissions.request(CLAUDE_ORIGINS).then(render);
});
browser.storage.onChanged.addListener(() => void render());
void render();
