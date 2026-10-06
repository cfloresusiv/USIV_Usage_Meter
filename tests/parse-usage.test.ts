import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isUsageRoute, parseUsage } from '../src/lib/parse-usage';

const fixture = (name: string) => readFileSync(resolve('tests/fixtures', name), 'utf8');

function load(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

// Miércoles 7 oct 2026, 09:00 hora local.
const NOW = new Date(2026, 9, 7, 9, 0, 0);

describe('isUsageRoute', () => {
  it('reconoce la ruta y el modal con hash', () => {
    expect(isUsageRoute('https://claude.ai/settings/usage')).toBe(true);
    expect(isUsageRoute('https://claude.ai/new#settings/usage')).toBe(true);
    expect(isUsageRoute('https://claude.ai/chat/123')).toBe(false);
    expect(isUsageRoute('https://claude.ai/new#settings/general')).toBe(false);
  });
});

describe('parseUsage (fixture es)', () => {
  const snap = parseUsage(load(fixture('usage-es.html')), NOW)!;

  it('lee plan y cuotas con su reinicio local', () => {
    expect(snap.plan).toBe('Pro');
    const session = snap.quotas.find((q) => q.kind === 'session')!;
    expect(session.percent).toBe(21);
    expect(session.reset.raw).toBe('Se restablece a las 10:40 a.m.');
    const at = new Date(session.reset.at!);
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([7, 10, 40]);

    const weekly = snap.quotas.find((q) => q.kind === 'weekly')!;
    expect(weekly.percent).toBe(16);
    const w = new Date(weekly.reset.at!);
    expect([w.getDay(), w.getDate(), w.getHours()]).toEqual([0, 11, 23]);
    expect(snap.coverage).toBe('complete');
  });

  it('separa créditos, créditos de uso y desglose por producto', () => {
    expect(snap.credits).toHaveLength(1);
    expect(snap.credits[0]).toMatchObject({
      label: 'Crédito incluido',
      percentUsed: 54,
      remaining: { amount: '46', currency: 'USD' },
      total: { amount: '100', currency: 'USD' },
    });
    expect(snap.credits[0]!.expiresRaw).toContain('Vence');
    expect(snap.usageCredits).toEqual({
      balance: { amount: '0', currency: 'USD' },
      monthlyLimit: { spent: { amount: '12.50', currency: 'USD' }, limit: { amount: '40', currency: 'USD' } },
    });
    expect(snap.productShares.map((p) => p.label)).toEqual(['Claude Code', 'Chats', 'Cowork']);
    // El desglose por producto no se mezcla con las cuotas.
    expect(snap.quotas).toHaveLength(2);
  });

  it('no guarda texto ajeno a las cifras de uso', () => {
    expect(JSON.stringify(snap)).not.toContain('conversación');
  });
});

describe('parseUsage (fixture en, campo ausente)', () => {
  const snap = parseUsage(load(fixture('usage-en.html')), NOW)!;

  it('marca como no disponible, nunca 0', () => {
    const weekly = snap.quotas.find((q) => q.kind === 'weekly')!;
    expect(weekly.percent).toBeNull();
    expect(snap.coverage).toBe('partial');
    expect(snap.missing).toContain('weekly.percent');
  });

  it('interpreta textos relativos como aproximados y monedas en inglés', () => {
    const session = snap.quotas.find((q) => q.kind === 'session')!;
    expect(session.percent).toBe(64);
    expect(session.reset.approximate).toBe(true);
    expect(new Date(session.reset.at!).getTime() - NOW.getTime()).toBe(200 * 60_000);
    expect(snap.plan).toBe('Max 5x');
    expect(snap.usageCredits?.balance).toEqual({ amount: '1234.56', currency: 'USD' });
    expect(snap.usageCredits?.monthlyLimit?.limit).toEqual({ amount: '50', currency: 'USD' });
  });
});

describe('parseUsage casos límite', () => {
  it('devuelve null si no hay medidores (DOM desconocido)', () => {
    expect(parseUsage(load('<main><h1>Otra página</h1></main>'), NOW)).toBeNull();
  });

  it('ignora el propio panel', () => {
    const doc = load('<div id="mine"><span id="x">Sesión actual</span><div role="meter" aria-valuenow="99" aria-labelledby="x"></div></div>');
    expect(parseUsage(doc, NOW, { exclude: doc.getElementById('mine') })).toBeNull();
  });
});
