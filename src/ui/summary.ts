import { formatMoney } from '../lib/amounts';
import { type MessageKey, t, uiLocale } from '../lib/i18n';
import type { Alert, Quota, Settings, UsageSnapshot } from '../lib/model';
import { minutesUntil } from '../lib/reset-time';
import { type ActiveView, level } from '../lib/view';
import { button, el } from './dom';

export interface SummaryActions {
  openUsage: () => void;
  useObserved: () => void;
  dismissAlert: (key: string) => void;
}

function duration(mins: number): string {
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return t('durDaysHours', d, h);
  if (h > 0) return t('durHoursMinutes', h, m);
  return t('durMinutes', Math.max(m, 1));
}

function relativeAgo(iso: string, now: Date): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(uiLocale(), { numeric: 'auto' });
  if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
  if (Math.abs(mins) < 1440) return rtf.format(-Math.round(mins / 60), 'hour');
  return rtf.format(-Math.round(mins / 1440), 'day');
}

function resetText(q: Quota, now: Date): string {
  const r = q.reset;
  if (r.at) {
    const mins = minutesUntil(r.at, now);
    if (mins <= 0) return t('resetPending');
    const when = new Intl.DateTimeFormat(uiLocale(), {
      weekday: mins > 1440 ? 'short' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(r.at));
    return `${r.approximate ? '≈ ' : ''}${t('resetsIn', duration(mins))} · ${when}`;
  }
  return r.raw ?? '';
}

function bar(percent: number | null, thresholds: number[]): HTMLElement {
  const lv = level(percent, thresholds);
  const fill = el('div', { class: `fill ${lv}` });
  fill.style.width = `${Math.min(percent ?? 0, 100)}%`;
  return el('div', { class: 'bar', role: 'presentation' }, fill);
}

function metricRow(label: string, percent: number | null, sub: string, thresholds: number[]): HTMLElement {
  return el(
    'div',
    { class: 'metric' },
    el(
      'div',
      { class: 'metric-head' },
      el('span', { class: 'metric-label' }, label),
      el('span', { class: `metric-value ${level(percent, thresholds)}` }, percent === null ? t('notAvailable') : `${Math.round(percent)}%`),
    ),
    bar(percent, thresholds),
    sub ? el('div', { class: 'metric-sub' }, sub) : null,
  );
}

function tag(text: string, kind = ''): HTMLElement {
  return el('span', { class: `tag ${kind}` }, text);
}

const SOURCE_TAG: Record<string, MessageKey> = { observed: 'tagObserved', manual: 'tagManual', demo: 'tagDemo' };

function alertsBlock(alerts: Alert[], actions: SummaryActions): HTMLElement | null {
  if (!alerts.length) return null;
  return el(
    'div',
    { class: 'alerts', role: 'status' },
    ...alerts.map((a) =>
      el(
        'div',
        { class: `alert ${a.threshold >= 100 ? 'crit' : 'warn'}` },
        el('span', {}, t('alertReached', a.metric === 'monthly-spend' ? t('monthlySpend') : a.metric, Math.round(a.percent))),
        button('×', () => actions.dismissAlert(a.key), { class: 'icon-btn', 'aria-label': t('dismiss') }),
      ),
    ),
  );
}

function body(s: UsageSnapshot, settings: Settings, now: Date): HTMLElement[] {
  const th = settings.thresholds;
  const loc = uiLocale();
  const out: HTMLElement[] = [];
  for (const q of s.quotas) out.push(metricRow(q.label, q.percent, resetText(q, now), th));

  for (const c of s.credits) {
    const parts: string[] = [];
    if (c.remaining && c.total) parts.push(t('creditRemaining', formatMoney(c.remaining, loc), formatMoney(c.total, loc)));
    if (c.expiresRaw) parts.push(c.expiresRaw);
    out.push(metricRow(c.label, c.percentUsed, parts.join(' · '), th));
  }

  const uc = s.usageCredits;
  if (uc && (uc.balance || uc.monthlyLimit)) {
    const rows: HTMLElement[] = [];
    if (uc.balance) rows.push(el('div', { class: 'kv' }, el('span', {}, t('usageCreditsBalance')), el('strong', {}, formatMoney(uc.balance, loc))));
    if (uc.monthlyLimit) {
      rows.push(
        el('div', { class: 'kv' }, el('span', {}, t('monthlySpend')), el('strong', {}, t('spentOf', formatMoney(uc.monthlyLimit.spent, loc), formatMoney(uc.monthlyLimit.limit, loc)))),
      );
    }
    out.push(el('div', { class: 'section' }, el('div', { class: 'section-title' }, t('usageCredits')), ...rows));
  }

  if (s.productShares.length) {
    out.push(
      el(
        'div',
        { class: 'section' },
        el('div', { class: 'section-title' }, t('byProduct')),
        el('div', { class: 'shares' }, s.productShares.map((p) => `${p.label} ${Math.round(p.percent)}%`).join(' · ')),
      ),
    );
  }
  return out;
}

export function renderSummary(
  view: ActiveView,
  settings: Settings,
  alerts: Alert[],
  actions: SummaryActions,
  now = new Date(),
): HTMLElement {
  const s = view.snapshot;
  const root = el('div', { class: 'summary' });
  root.append(...[alertsBlock(alerts, actions)].filter((x): x is HTMLElement => !!x));

  if (view.newerObserved) {
    root.append(el('div', { class: 'notice' }, el('span', {}, t('newerObserved')), button(t('useObserved'), actions.useObserved, { class: 'link-btn' })));
  }

  if (!s) {
    root.append(
      el(
        'div',
        { class: 'empty' },
        el('p', {}, view.source === 'manual' ? t('emptyManual') : t('emptyObserved')),
        button(t('openUsage'), actions.openUsage, { class: 'primary-btn' }),
      ),
    );
    return root;
  }

  const tags = el('div', { class: 'tags' });
  if (s.plan) tags.append(tag(s.plan, 'plan'));
  tags.append(tag(t(SOURCE_TAG[s.source]!), s.source));
  if (view.stale) tags.append(tag(t('tagStale'), 'stale'));
  if (s.coverage === 'partial') tags.append(tag(t('tagPartial'), 'stale'));
  root.append(tags, ...body(s, settings, now));

  const foot = el('div', { class: 'updated' }, t('updatedAgo', relativeAgo(s.observedAt, now)));
  if (view.stale && s.source === 'observed') foot.append(' · ', button(t('refreshNow'), actions.openUsage, { class: 'link-btn' }));
  root.append(foot);
  return root;
}
