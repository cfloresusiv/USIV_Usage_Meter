import { browser } from 'wxt/browser';

/** Claves de _locales, tipadas por WXT: un error de tipeo falla en compilación. */
export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

/** Texto traducido desde _locales; si falta la clave devuelve la propia clave. */
export function t(key: MessageKey, ...subs: Array<string | number>): string {
  const msg = browser.i18n.getMessage(key, subs.map(String));
  return msg || key;
}

export function uiLocale(): string {
  return browser.i18n.getUILanguage();
}

/** Aplica traducciones a elementos con data-i18n / data-i18n-title (páginas propias). */
export function localizeDocument(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as MessageKey);
  });
}
