import type { ResetInfo } from './model';

// Interpreta textos de reinicio en español e inglés usando la zona horaria
// local del navegador (Date maneja los cambios de horario; no se asume offset).

const WEEKDAYS: Array<[RegExp, number]> = [
  [/\b(domingo|sunday|sun)\b/i, 0],
  [/\b(lunes|monday|mon)\b/i, 1],
  [/\b(martes|tuesday|tue|tues)\b/i, 2],
  [/\b(mi[eé]rcoles|wednesday|wed)\b/i, 3],
  [/\b(jueves|thursday|thu|thur|thurs)\b/i, 4],
  [/\b(viernes|friday|fri)\b/i, 5],
  [/\b(s[aá]bado|saturday|sat)\b/i, 6],
];

const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?(?=[\s,.)]|$)/i;
const REL_RE =
  /\b(?:en|in)\s+(?:(\d+)\s*(?:h|hr|hrs|hora|horas|hour|hours)\b)?\s*(?:(\d+)\s*(?:min|mins|minuto|minutos|minute|minutes)\b)?/i;

function parseClock(text: string): { h: number; m: number } | null {
  // Solo horas con minutos o con am/pm, para no confundir días del mes.
  const re = new RegExp(TIME_RE.source, 'gi');
  for (const match of text.matchAll(re)) {
    const [, hs, ms, ampm] = match;
    if (ms === undefined && !ampm) continue;
    let h = Number(hs);
    const m = ms === undefined ? 0 : Number(ms);
    if (m > 59) continue;
    if (ampm) {
      if (h < 1 || h > 12) continue;
      const pm = /^p/i.test(ampm);
      if (pm && h !== 12) h += 12;
      if (!pm && h === 12) h = 0;
    } else if (h > 23) {
      continue;
    }
    return { h, m };
  }
  return null;
}

export function parseReset(raw: string | null, now: Date): ResetInfo {
  const text = raw?.trim() || null;
  if (!text) return { at: null, raw: null, approximate: false };

  const rel = REL_RE.exec(text);
  if (rel && (rel[1] || rel[2])) {
    const mins = Number(rel[1] ?? 0) * 60 + Number(rel[2] ?? 0);
    return { at: new Date(now.getTime() + mins * 60_000).toISOString(), raw: text, approximate: true };
  }

  const clock = parseClock(text);
  if (!clock) return { at: null, raw: text, approximate: false };

  const weekday = WEEKDAYS.find(([re]) => re.test(text))?.[1];
  const d = new Date(now);
  d.setHours(clock.h, clock.m, 0, 0);
  if (weekday !== undefined) {
    let add = (weekday - now.getDay() + 7) % 7;
    if (add === 0 && d <= now) add = 7;
    d.setDate(d.getDate() + add);
  } else if (/\b(mañana|tomorrow)\b/i.test(text) || d <= now) {
    d.setDate(d.getDate() + 1);
  }
  return { at: d.toISOString(), raw: text, approximate: false };
}

/** Minutos restantes hasta el reinicio; negativo si ya venció. */
export function minutesUntil(at: string, now: Date): number {
  return Math.round((new Date(at).getTime() - now.getTime()) / 60_000);
}
