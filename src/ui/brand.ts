import { browser } from 'wxt/browser';
import { t } from '../lib/i18n';
import { USIV_URL } from '../lib/model';
import { el } from './dom';

export function logoUrl(size: 16 | 32 | 48 | 128 = 32): string {
  return browser.runtime.getURL(`/icon/${size}.png`);
}

/** Crédito discreto a USIV; abre usiv.cl en una pestaña nueva. */
export function brandFooter(): HTMLElement {
  return el(
    'div',
    { class: 'brand-foot' },
    el('img', { src: logoUrl(32), alt: '' }),
    el('span', {}, t('madeBy')),
    el('a', { href: USIV_URL, target: '_blank', rel: 'noopener noreferrer' }, 'USIV'),
  );
}

export function applyTheme(node: HTMLElement, theme: string): void {
  node.classList.add('usiv-theme');
  node.dataset.theme = theme;
}
