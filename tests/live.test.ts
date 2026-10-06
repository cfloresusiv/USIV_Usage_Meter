import { describe, expect, it } from 'vitest';
import { demoSnapshot } from '../src/lib/demo';
import { applyLiveUsage, pickOrgId } from '../src/lib/live';

const NOW = new Date('2026-10-07T12:00:00Z');
const ORG = '0a1b2c3d-4e5f-6789-abcd-ef0123456789';

describe('pickOrgId', () => {
  it('prefiere la organización con chat y descarta ids inválidos', () => {
    expect(
      pickOrgId([
        { uuid: '../x', capabilities: ['chat'] },
        { uuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff', capabilities: ['api'] },
        { uuid: ORG, capabilities: ['claude_pro', 'chat'] },
      ]),
    ).toBe(ORG);
    expect(pickOrgId({ error: 'x' })).toBeNull();
    expect(pickOrgId([])).toBeNull();
  });
});

describe('applyLiveUsage', () => {
  const base = { ...demoSnapshot(NOW), source: 'observed' as const };

  it('actualiza sesión y semana, conserva el resto', () => {
    const snap = applyLiveUsage(
      base,
      {
        five_hour: { utilization: 84, resets_at: '2026-10-07T13:40:00.084137+00:00' },
        seven_day: { utilization: 24.5, resets_at: '2026-10-12T02:00:00.084155+00:00' },
      },
      NOW,
    )!;
    expect(snap.observedAt).toBe(NOW.toISOString());
    expect(snap.quotas.find((q) => q.kind === 'session')).toMatchObject({
      percent: 84,
      reset: { at: '2026-10-07T13:40:00.000Z', raw: null, approximate: false },
    });
    expect(snap.quotas.find((q) => q.kind === 'weekly')?.percent).toBe(24.5);
    expect(snap.credits).toEqual(base.credits);
    expect(snap.plan).toBe(base.plan);
  });

  it('ignora respuestas sin cuotas reconocibles', () => {
    expect(applyLiveUsage(base, { five_hour: null, seven_day: { utilization: 'x' } }, NOW)).toBeNull();
    expect(applyLiveUsage(base, null, NOW)).toBeNull();
  });
});
