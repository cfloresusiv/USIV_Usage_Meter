import { findMoney } from './amounts';
import type { CreditPool, ProductShare, Quota, QuotaKind, UsageCredits, UsageSnapshot } from './model';
import { parseReset } from './reset-time';

// Adaptador de la vista oficial de uso de claude.ai (/settings/usage, hoy un
// modal en "#settings/usage"). Se apoya en roles ARIA (role="meter",
// aria-valuenow, aria-labelledby) y encabezados, no en clases CSS generadas.
// Lee solo cifras agregadas de esa vista; si algo no se reconoce, queda como
// no disponible en vez de cero.

const RE = {
  usageHeading: /^(tu uso|your usage)\b|^(uso|usage)$/i,
  creditHeading: /cr[eé]dito|credit/i,
  productHeading: /por producto|by product/i,
  usageCreditsHeading: /^(cr[eé]ditos de uso|usage credits|extra usage|uso adicional)/i,
  session: /sesi[oó]n|session/i,
  weekly: /semana|week/i,
  reset: /restablece|reinicia|reinicio|resets?\b|renews?/i,
  remaining: /quedan|restan|remaining|left/i,
  expires: /vence|expira|caduca|expires?/i,
  monthly: /(este mes|this month|mensual|monthly)/i,
  percentOnly: /^\s*\d{1,3}(?:[.,]\d+)?\s*%/,
  plan: /\b(Free|Gratis|Pro|Max(?:\s*\(?\d+x\)?)?|Team|Equipo|Enterprise)\b/i,
};

const HEADINGS = 'h1,h2,h3,h4,h5,h6,[role="heading"]';

export function isUsageRoute(href: string): boolean {
  try {
    const u = new URL(href);
    return /\/settings\/usage\b/.test(u.pathname) || /^#\/?settings\/usage\b/.test(u.hash);
  } catch {
    return false;
  }
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function slug(s: string): string {
  return clean(s).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'x';
}

function headingLevel(h: Element): number {
  const m = /^H(\d)$/.exec(h.tagName);
  if (m) return Number(m[1]);
  return Number(h.getAttribute('aria-level')) || 2;
}

/** Fragmentos de texto visibles dentro de `el`, excluyendo los subárboles indicados. */
function textParts(el: Element, skip: Element[] = []): string[] {
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent || skip.some((s) => s.contains(parent))) continue;
    if (parent.closest('script,style,svg,[aria-hidden="true"]')) continue;
    const t = clean(n.textContent);
    if (t) parts.push(t);
  }
  return parts;
}

function precedingHeading(target: Element, headings: Element[]): Element | null {
  let found: Element | null = null;
  for (const h of headings) {
    if (h.compareDocumentPosition(target) & 4 /* FOLLOWING */) found = h;
    else break;
  }
  return found;
}

/** Texto de la sección que inicia en `h` hasta el siguiente encabezado de igual o mayor nivel. */
function sectionText(h: Element, headings: Element[], scope: Element): string {
  const level = headingLevel(h);
  const idx = headings.indexOf(h);
  const end = headings.slice(idx + 1).find((x) => headingLevel(x) <= level) ?? null;
  const doc = scope.ownerDocument;
  const walker = doc.createTreeWalker(scope, 4);
  const out: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!(h.compareDocumentPosition(n) & 4) || h.contains(n)) continue;
    if (end && !(end.compareDocumentPosition(n) & 2 /* PRECEDING */)) break;
    if (n.parentElement?.closest('script,style,svg')) continue;
    const t = clean(n.textContent);
    if (t) out.push(t);
  }
  return out.join(' ¦ ');
}

function readPercent(meter: Element): number | null {
  const raw = meter.getAttribute('aria-valuenow') ?? (meter as HTMLProgressElement).value?.toString();
  if (raw == null || raw === '') return null;
  const v = Number(raw);
  const max = Number(meter.getAttribute('aria-valuemax') ?? 100) || 100;
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round((v / max) * 1000) / 10;
}

function labelFor(meter: Element): Element | null {
  const ids = meter.getAttribute('aria-labelledby');
  if (!ids) return null;
  const doc = meter.ownerDocument;
  return ids.split(/\s+/).map((id) => doc.getElementById(id)).find(Boolean) ?? null;
}

function rowFor(meter: Element, label: Element | null): Element {
  let row: Element = label ?? meter;
  while (!row.contains(meter) && row.parentElement) row = row.parentElement;
  return row;
}

function quotaKind(label: string): QuotaKind {
  if (RE.session.test(label)) return 'session';
  if (RE.weekly.test(label)) return 'weekly';
  return 'other';
}

export interface ParseOptions {
  /** Nodo a ignorar (el propio panel), para no leerse a sí mismo. */
  exclude?: Element | null;
}

export function parseUsage(doc: Document, now: Date, opts: ParseOptions = {}): UsageSnapshot | null {
  const notMine = (e: Element) => !opts.exclude || !opts.exclude.contains(e);
  const allMeters = [...doc.querySelectorAll('[role="meter"],[role="progressbar"],progress')].filter(notMine);
  if (allMeters.length === 0) return null;

  // Ámbito: el diálogo de configuración si existe; si no, el <main>.
  const scope =
    allMeters[0]!.closest('[role="dialog"]') ?? allMeters[0]!.closest('main') ?? doc.body;
  const meters = allMeters.filter((m) => scope.contains(m));
  const headings = [...scope.querySelectorAll(HEADINGS)].filter(notMine);

  const quotas: Quota[] = [];
  const credits: CreditPool[] = [];
  const productShares: ProductShare[] = [];
  const usedIds = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`;
    usedIds.add(id);
    return id;
  };

  for (const meter of meters) {
    const labelEl = labelFor(meter);
    const label = clean(labelEl?.textContent ?? meter.getAttribute('aria-label'));
    if (!label) continue;
    const percent = readPercent(meter);
    const row = rowFor(meter, labelEl);
    const extra = textParts(row, labelEl ? [labelEl] : []).filter((t) => !RE.percentOnly.test(t));
    const section = clean(precedingHeading(meter, headings)?.textContent);

    if (RE.productHeading.test(section)) {
      if (percent !== null) productShares.push({ label, percent });
    } else if (RE.creditHeading.test(section) && !RE.usageHeading.test(section)) {
      const text = extra.join(' ¦ ');
      const money = findMoney(text);
      const isRemaining = RE.remaining.test(text);
      credits.push({
        id: uniqueId(`credit-${slug(label)}`),
        label,
        percentUsed: percent,
        remaining: isRemaining ? (money[0] ?? null) : null,
        total: money.length >= 2 ? money[1]! : null,
        expiresRaw: extra.find((t) => RE.expires.test(t)) ?? null,
      });
    } else {
      const resetRaw = extra.find((t) => RE.reset.test(t)) ?? null;
      quotas.push({
        id: uniqueId(slug(label)),
        kind: quotaKind(label),
        label,
        percent,
        reset: parseReset(resetRaw, now),
      });
    }
  }

  const usageHeading = headings.find((h) => RE.usageHeading.test(clean(h.textContent)));
  let plan: string | null = null;
  if (usageHeading?.parentElement) {
    const near = textParts(usageHeading.parentElement, [usageHeading]).join(' ');
    plan = RE.plan.exec(near)?.[1] ?? null;
  }

  let usageCredits: UsageCredits | null = null;
  const ucHeading = headings.find((h) => RE.usageCreditsHeading.test(clean(h.textContent)));
  if (ucHeading) {
    const text = sectionText(ucHeading, headings, scope);
    const parts = text.split(' ¦ ');
    const limitPart = parts.find((p) => RE.monthly.test(p) && findMoney(p).length >= 2);
    const limitMoney = limitPart ? findMoney(limitPart) : [];
    const balancePart = parts.find((p) => p !== limitPart && findMoney(p).length === 1 && /^\S*\s?[\d.,]+$/.test(p));
    usageCredits = {
      balance: balancePart ? (findMoney(balancePart)[0] ?? null) : null,
      monthlyLimit:
        limitMoney.length >= 2 ? { spent: limitMoney[0]!, limit: limitMoney[1]! } : null,
    };
  }

  const missing: string[] = [];
  const session = quotas.find((q) => q.kind === 'session');
  const weekly = quotas.find((q) => q.kind === 'weekly');
  if (!session) missing.push('session');
  else if (session.percent === null) missing.push('session.percent');
  if (!weekly) missing.push('weekly');
  else if (weekly.percent === null) missing.push('weekly.percent');
  if (!plan) missing.push('plan');
  for (const q of quotas) if (q.reset.raw && !q.reset.at) missing.push(`${q.id}.reset`);

  if (quotas.length === 0 && credits.length === 0) return null;

  return {
    version: 1,
    source: 'observed',
    observedAt: now.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    plan,
    quotas,
    credits,
    usageCredits,
    productShares,
    coverage: missing.some((m) => m === 'session' || m === 'weekly' || m.endsWith('.percent'))
      ? 'partial'
      : 'complete',
    missing,
  };
}
