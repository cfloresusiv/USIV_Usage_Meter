import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// fake-browser no implementa i18n: se usa el catálogo real en español.
const es = JSON.parse(readFileSync(resolve('public/_locales/es/messages.json'), 'utf8')) as Record<
  string,
  { message: string }
>;

function mockI18n(): void {
  vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation(((key: string, subs?: string | string[]) => {
    const list = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs];
    return (es[key]?.message ?? '').replace(/\$(\d)/g, (_, n: string) => list[Number(n) - 1] ?? '');
  }) as typeof fakeBrowser.i18n.getMessage);
  vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('es-CL');
}

mockI18n();
beforeEach(mockI18n);
