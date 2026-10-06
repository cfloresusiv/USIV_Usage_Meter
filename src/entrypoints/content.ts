import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { isUsageRoute, parseUsage } from '../lib/parse-usage';
import type { UsageSnapshot } from '../lib/model';
import { FloatingPanel } from '../ui/panel';

const DEBOUNCE_MS = 800;

/** Firma sin la hora de observación, para no reenviar datos idénticos. */
function signature(s: UsageSnapshot): string {
  return JSON.stringify({ ...s, observedAt: '', quotas: s.quotas.map((q) => ({ ...q, reset: q.reset.raw })) });
}

export default defineContentScript({
  matches: ['https://claude.ai/*'],
  runAt: 'document_idle',
  async main(ctx) {
    const panel = new FloatingPanel();
    await panel.mount();
    ctx.onInvalidated(() => panel.destroy());

    // Lector acotado: solo activo mientras se muestra la vista oficial de uso.
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSig = '';

    const read = () => {
      const snap = parseUsage(document, new Date(), { exclude: panel.host });
      if (!snap) return;
      const sig = signature(snap);
      // Datos idénticos no se reenvían: una pestaña abierta sin recargar no debe
      // presentar datos viejos como recientes ni pisar lecturas más nuevas.
      if (sig === lastSig) return;
      lastSig = sig;
      void browser.runtime.sendMessage({ type: 'observed', snapshot: snap }).catch(() => {});
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(read, DEBOUNCE_MS);
    };

    const sync = () => {
      if (isUsageRoute(location.href)) {
        if (observer) return;
        lastSig = '';
        observer = new MutationObserver((records) => {
          if (records.every((r) => panel.host.contains(r.target))) return;
          schedule();
        });
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['aria-valuenow', 'aria-valuetext'],
        });
        schedule();
      } else if (observer) {
        observer.disconnect();
        observer = null;
        clearTimeout(timer);
      }
    };

    ctx.addEventListener(window, 'wxt:locationchange', sync);
    ctx.addEventListener(window, 'hashchange', sync);
    ctx.onInvalidated(() => {
      observer?.disconnect();
      clearTimeout(timer);
    });
    sync();
  },
});
