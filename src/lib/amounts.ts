import type { Money } from './model';

const CURRENCY_ALIASES: Record<string, string> = {
  USD: 'USD',
  'US$': 'USD',
  EUR: 'EUR',
  '€': 'EUR',
  CLP: 'CLP',
  GBP: 'GBP',
  '£': 'GBP',
  $: '$',
};

const MONEY_RE = /(US\$|USD|EUR|CLP|GBP|€|£|\$)\s?(\d[\d.,  ]*\d|\d)/g;

/**
 * Normaliza un número localizado ("1.234,56", "1,234.56", "0.00") a decimal
 * canónico con punto. Devuelve null si no es interpretable.
 */
export function normalizeDecimal(input: string): string | null {
  const s = input.replace(/[\s ]/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let out: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    out = s.split(thou).join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    out = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0) {
    out = /^\d{1,3}(\.\d{3}){2,}$/.test(s) ? s.replace(/\./g, '') : s;
  } else {
    out = s;
  }
  return /^\d+(\.\d+)?$/.test(out) ? out : null;
}

/** Extrae todos los importes con moneda presentes en un texto, en orden. */
export function findMoney(text: string): Money[] {
  const result: Money[] = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const amount = normalizeDecimal(m[2] ?? '');
    const currency = CURRENCY_ALIASES[m[1] ?? ''];
    if (amount !== null && currency) result.push({ amount, currency });
  }
  return result;
}

/** Formatea para mostrar; la precisión interna se conserva en la cadena. */
export function formatMoney(m: Money, locale?: string): string {
  const n = Number(m.amount);
  if (/^[A-Z]{3}$/.test(m.currency)) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: m.currency,
      currencyDisplay: 'code',
      maximumFractionDigits: 2,
    }).format(n);
  }
  return `${m.currency}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)}`;
}

/** Porcentaje gastado (para umbrales). null si el límite es 0 o monedas distintas. */
export function ratioPercent(spent: Money, limit: Money): number | null {
  if (spent.currency !== limit.currency) return null;
  const l = Number(limit.amount);
  if (!(l > 0)) return null;
  return (Number(spent.amount) / l) * 100;
}
