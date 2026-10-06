import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { demoSnapshot } from '../src/lib/demo';
import { DEFAULT_SETTINGS } from '../src/lib/model';
import { getSnapshots, patchSettings, saveSnapshot } from '../src/lib/store';
import { activeView } from '../src/lib/view';
import { FloatingPanel } from '../src/ui/panel';
import { renderSummary } from '../src/ui/summary';

const noop = { openUsage: () => {}, useObserved: () => {}, dismissAlert: () => {} };

describe('renderSummary', () => {
  it('muestra cuotas, etiqueta Demo y "no disponible" en vez de 0', () => {
    const demo = demoSnapshot(new Date());
    demo.quotas[1]!.percent = null;
    const view = { snapshot: demo, source: 'demo' as const, stale: false, newerObserved: false };
    const node = renderSummary(view, DEFAULT_SETTINGS, [], noop);
    expect(node.querySelectorAll('.metric')).toHaveLength(3);
    expect(node.querySelector('.tag.demo')).not.toBeNull();
    expect(node.querySelectorAll('.metric-value.none')).toHaveLength(1);
    expect(node.innerHTML).not.toContain('<script');
  });

  it('estado vacío ofrece abrir la página de uso', () => {
    const view = activeView(DEFAULT_SETTINGS, {}, new Date());
    const node = renderSummary(view, DEFAULT_SETTINGS, [], noop);
    expect(node.querySelector('.empty button')).not.toBeNull();
  });
});

describe('FloatingPanel', () => {
  beforeEach(() => fakeBrowser.reset());

  it('monta una sola instancia y respeta el cierre', async () => {
    await saveSnapshot({ ...demoSnapshot(new Date()), source: 'observed' });
    const a = new FloatingPanel();
    await a.mount();
    const b = new FloatingPanel();
    await b.mount();
    expect(document.querySelectorAll('#usiv-usage-meter-host')).toHaveLength(1);
    expect(Object.keys(await getSnapshots())).toEqual(['observed']);

    await patchSettings({ panelEnabled: false });
    b.destroy();
    a.destroy();
    expect(document.querySelectorAll('#usiv-usage-meter-host')).toHaveLength(0);
  });
});
