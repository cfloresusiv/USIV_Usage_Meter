import { describe, expect, it } from 'vitest';
import { evaluateAlerts } from '../src/lib/alerts';
import { findMoney, normalizeDecimal, ratioPercent } from '../src/lib/amounts';
import { demoSnapshot } from '../src/lib/demo';
import { DEFAULT_SETTINGS, type UsageSnapshot } from '../src/lib/model';
import { parseReset } from '../src/lib/reset-time';
import { validateSnapshot } from '../src/lib/validate';
import { activeView, level } from '../src/lib/view';

const NOW = new Date(2026, 9, 7, 9, 0, 0); // miércoles

describe('amounts', () => {
  it.each([
    ['0.00', '0.00'],
    ['46', '46'],
    ['1,234.56', '1234.56'],
    ['1.234,56', '1234.56'],
    ['12,5', '12.5'],
    ['1,234', '1234'],
    ['1.234.567', '1234567'],
    ['abc', null],
  ])('normalizeDecimal(%s) = %s', (input, out) => {
    expect(normalizeDecimal(input)).toBe(out);
  });

  it('extrae importes en orden y con moneda', () => {
    expect(findMoney('Quedan USD 46 de USD 100')).toEqual([
      { amount: '46', currency: 'USD' },
      { amount: '100', currency: 'USD' },
    ]);
    expect(findMoney('Sin importes')).toEqual([]);
  });

  it('calcula proporciones solo con la misma moneda', () => {
    expect(ratioPercent({ amount: '10', currency: 'USD' }, { amount: '40', currency: 'USD' })).toBe(25);
    expect(ratioPercent({ amount: '10', currency: 'USD' }, { amount: '40', currency: 'EUR' })).toBeNull();
    expect(ratioPercent({ amount: '10', currency: 'USD' }, { amount: '0', currency: 'USD' })).toBeNull();
  });
});

describe('parseReset', () => {
  const at = (raw: string) => new Date(parseReset(raw, NOW).at!);

  it('hora ya pasada hoy => mañana', () => {
    const d = at('Se restablece a las 8:15 a.m.');
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([8, 8, 15]);
  });
  it('12 p.m. y 12 a.m.', () => {
    expect(at('Resets at 12:00 PM').getHours()).toBe(12);
    expect(at('Resets at 12:30 AM').getHours()).toBe(0);
  });
  it('mismo día de la semana con hora pasada => próxima semana', () => {
    const d = at('Se restablece el miércoles, 7:00 a.m.');
    expect(d.getDate()).toBe(14);
  });
  it('texto no interpretable conserva el original', () => {
    expect(parseReset('Pronto', NOW)).toEqual({ at: null, raw: 'Pronto', approximate: false });
    expect(parseReset(null, NOW)).toEqual({ at: null, raw: null, approximate: false });
  });
  it('no confunde días del mes con horas', () => {
    expect(parseReset('Vence el 5 de noviembre', NOW).at).toBeNull();
  });
});

describe('validateSnapshot', () => {
  it('acepta un snapshot válido', () => {
    const demo = demoSnapshot(NOW);
    expect(validateSnapshot(demo)).toEqual(demo);
  });
  it('rechaza o depura datos inválidos', () => {
    expect(validateSnapshot({ version: 2 })).toBeNull();
    expect(validateSnapshot({ version: 1, source: 'evil', observedAt: NOW.toISOString() })).toBeNull();
    const dirty = validateSnapshot({
      ...demoSnapshot(NOW),
      plan: 'x'.repeat(500),
      quotas: [{ id: 'a', kind: 'session', label: 'S', percent: 'NaN', reset: {} }],
      extra: '<script>',
    })!;
    expect(dirty.plan).toHaveLength(40);
    expect(dirty.quotas[0]!.percent).toBeNull();
    expect('extra' in dirty).toBe(false);
  });
});

describe('view', () => {
  const observed: UsageSnapshot = { ...demoSnapshot(NOW), source: 'observed' };

  it('marca desactualizado tras el umbral', () => {
    const later = new Date(NOW.getTime() + 20 * 60_000);
    expect(activeView(DEFAULT_SETTINGS, { observed }, later).stale).toBe(true);
    expect(activeView(DEFAULT_SETTINGS, { observed }, NOW).stale).toBe(false);
  });
  it('Demo nunca se marca desactualizado ni se usa sin pedirlo', () => {
    const v = activeView(DEFAULT_SETTINGS, { demo: demoSnapshot(NOW) }, NOW);
    expect(v.snapshot).toBeNull();
  });
  it('avisa de observación más reciente que el dato manual', () => {
    const manual = { ...observed, source: 'manual' as const, observedAt: new Date(NOW.getTime() - 60_000).toISOString() };
    const v = activeView({ ...DEFAULT_SETTINGS, activeSource: 'manual' }, { manual, observed }, NOW);
    expect(v.newerObserved).toBe(true);
    expect(v.snapshot?.source).toBe('manual');
  });
  it('niveles de color', () => {
    expect(level(null, [50, 80, 100])).toBe('none');
    expect(level(40, [50, 80, 100])).toBe('ok');
    expect(level(85, [50, 80, 100])).toBe('warn');
    expect(level(100, [50, 80, 100])).toBe('crit');
  });
});

describe('alerts', () => {
  const observed: UsageSnapshot = { ...demoSnapshot(NOW), source: 'observed' };

  it('una alerta por umbral y período, deduplicada', () => {
    const first = evaluateAlerts(observed, DEFAULT_SETTINGS, [], NOW);
    // Semana 83 % => solo el umbral más alto alcanzado (80) genera aviso.
    const weekly = first.alerts.filter((a) => a.metric === 'Sesión actual' || a.metric === 'Esta semana');
    expect(weekly).toHaveLength(1);
    expect(weekly[0]).toMatchObject({ metric: 'Esta semana', threshold: 80 });
    const again = evaluateAlerts(observed, DEFAULT_SETTINGS, first.fired, NOW);
    expect(again.alerts).toEqual([]);
  });
  it('no alerta con Demo ni con manual salvo que se habilite', () => {
    expect(evaluateAlerts(demoSnapshot(NOW), DEFAULT_SETTINGS, [], NOW).alerts).toEqual([]);
    const manual = { ...observed, source: 'manual' as const };
    expect(evaluateAlerts(manual, DEFAULT_SETTINGS, [], NOW).alerts).toEqual([]);
    expect(evaluateAlerts(manual, { ...DEFAULT_SETTINGS, manualAlerts: true }, [], NOW).alerts.length).toBeGreaterThan(0);
  });
  it('un nuevo período vuelve a avisar', () => {
    const first = evaluateAlerts(observed, DEFAULT_SETTINGS, [], NOW);
    const next = {
      ...observed,
      quotas: observed.quotas.map((q) => ({ ...q, reset: { ...q.reset, at: '2026-10-20T00:00:00.000Z' } })),
    };
    expect(evaluateAlerts(next, DEFAULT_SETTINGS, first.fired, NOW).alerts.length).toBeGreaterThan(0);
  });
});
