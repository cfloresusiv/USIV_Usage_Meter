import { browser } from 'wxt/browser';
import { t } from '../lib/i18n';
import type { Alert, PanelState, Settings } from '../lib/model';
import { STORAGE_KEYS } from '../lib/model';
import {
  dismissAlert,
  getActiveAlerts,
  getPanelState,
  getSettings,
  getSnapshots,
  patchSettings,
  setPanelState,
} from '../lib/store';
import { activeView, level, type Snapshots } from '../lib/view';
import panelCss from './panel.css?inline';
import themeCss from './theme.css?inline';
import { applyTheme, brandFooter, logoUrl } from './brand';
import { button, el } from './dom';
import { renderSummary } from './summary';

const MARGIN = 8;
const HOST_ID = 'usiv-usage-meter-host';

/** Panel flotante aislado en Shadow DOM. Una sola instancia por pestaña. */
export class FloatingPanel {
  readonly host: HTMLElement;
  private shadow: ShadowRoot;
  private wrap: HTMLElement;
  private settings!: Settings;
  private snaps: Snapshots = {};
  private alerts: Alert[] = [];
  private pos: PanelState = { x: null, y: null, minimized: false };
  private timer: ReturnType<typeof setInterval> | undefined;
  private onStorage = (changes: Record<string, unknown>, area: string) => {
    if (area !== 'local') return;
    const keys = Object.keys(changes);
    if (keys.some((k) => k.startsWith('snap:') || k === STORAGE_KEYS.settings || k.startsWith('alerts:'))) {
      void this.reload();
    }
  };
  private onResize = () => this.clamp(true);

  constructor() {
    document.getElementById(HOST_ID)?.remove();
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `${themeCss}\n${panelCss}`;
    this.wrap = document.createElement('div');
    this.shadow.append(style, this.wrap);
  }

  async mount(): Promise<void> {
    document.documentElement.append(this.host);
    this.pos = await getPanelState();
    await this.reload();
    browser.storage.onChanged.addListener(this.onStorage);
    window.addEventListener('resize', this.onResize);
    this.timer = setInterval(() => this.render(), 30_000);
  }

  destroy(): void {
    browser.storage.onChanged.removeListener(this.onStorage);
    window.removeEventListener('resize', this.onResize);
    clearInterval(this.timer);
    this.host.remove();
  }

  private async reload(): Promise<void> {
    [this.settings, this.snaps, this.alerts] = await Promise.all([getSettings(), getSnapshots(), getActiveAlerts()]);
    this.render();
  }

  private render(): void {
    if (!this.settings) return;
    this.wrap.replaceChildren();
    if (!this.settings.panelEnabled) return;
    applyTheme(this.wrap, this.settings.theme);
    const view = activeView(this.settings, this.snaps, new Date());
    const actions = {
      openUsage: () => void browser.runtime.sendMessage({ type: 'openUsage' }),
      useObserved: () => void patchSettings({ activeSource: 'observed' }),
      dismissAlert: (key: string) => void dismissAlert(key),
    };

    let node: HTMLElement;
    let handle: HTMLElement;
    if (this.pos.minimized) {
      const session = view.snapshot?.quotas.find((q) => q.kind === 'session') ?? view.snapshot?.quotas[0];
      const p = session?.percent ?? null;
      node = el(
        'div',
        { class: 'capsule', role: 'button', tabindex: '0', title: t('expand'), 'aria-label': t('expand') },
        el('img', { src: logoUrl(48), alt: '' }),
        el('span', { class: level(p, this.settings.thresholds) }, p === null ? '—' : `${Math.round(p)}%`),
      );
      handle = node;
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') this.setMinimized(false);
      });
    } else {
      handle = el(
        'div',
        { class: 'panel-head' },
        el('img', { src: logoUrl(48), alt: '' }),
        el('span', { class: 'panel-title' }, t('extName')),
        button('↻', actions.openUsage, { class: 'icon-btn', title: t('refreshNow'), 'aria-label': t('refreshNow') }),
        button('–', () => this.setMinimized(true), { class: 'icon-btn', title: t('minimize'), 'aria-label': t('minimize') }),
        button('×', () => void patchSettings({ panelEnabled: false }), { class: 'icon-btn', title: t('closePanel'), 'aria-label': t('closePanel') }),
      );
      node = el(
        'div',
        { class: 'panel', role: 'complementary', 'aria-label': t('extName') },
        handle,
        el('div', { class: 'panel-body' }, renderSummary(view, this.settings, this.alerts, actions)),
        el('div', { class: 'panel-foot' }, brandFooter()),
      );
    }
    this.wrap.append(node);
    this.enableDrag(node, handle);
    this.place(node);
  }

  private setMinimized(minimized: boolean): void {
    this.pos = { ...this.pos, minimized };
    void setPanelState(this.pos);
    this.render();
  }

  private place(node: HTMLElement): void {
    const r = node.getBoundingClientRect();
    if (this.pos.x === null || this.pos.y === null) {
      // Esquina inferior derecha, por encima del área del cuadro de escritura.
      this.pos = { ...this.pos, x: window.innerWidth - r.width - 16, y: window.innerHeight - r.height - 110 };
    }
    node.style.left = `${this.pos.x}px`;
    node.style.top = `${this.pos.y}px`;
    this.clamp(false);
  }

  /** Mantiene el panel dentro de la ventana visible. */
  private clamp(persist: boolean): void {
    const node = this.wrap.firstElementChild as HTMLElement | null;
    if (!node || this.pos.x === null || this.pos.y === null) return;
    const r = node.getBoundingClientRect();
    const x = Math.min(Math.max(this.pos.x, MARGIN), Math.max(MARGIN, window.innerWidth - r.width - MARGIN));
    const y = Math.min(Math.max(this.pos.y, MARGIN), Math.max(MARGIN, window.innerHeight - r.height - MARGIN));
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    if (persist && (x !== this.pos.x || y !== this.pos.y)) {
      this.pos = { ...this.pos, x, y };
      void setPanelState(this.pos);
    }
  }

  private enableDrag(node: HTMLElement, handle: HTMLElement): void {
    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      const start = { x: e.clientX, y: e.clientY, left: node.offsetLeft, top: node.offsetTop };
      let moved = false;
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('dragging');
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        this.pos = { ...this.pos, x: start.left + dx, y: start.top + dy };
        this.clamp(false);
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        handle.classList.remove('dragging');
        if (moved) {
          this.clamp(true);
          void setPanelState(this.pos);
        } else if (this.pos.minimized) {
          this.setMinimized(false);
        }
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }
}
