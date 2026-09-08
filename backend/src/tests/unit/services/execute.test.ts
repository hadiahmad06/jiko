import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMessage = vi.fn();
vi.mock('../../../services/messaging/outbox.js', () => ({ sendMessage: (...a: unknown[]) => sendMessage(...a), budgetStatus: vi.fn() }));
vi.mock('../../../services/messaging/voice.js', () => ({ voiceRewrite: async (t: string) => t }));
vi.mock('../../../services/summary.js', () => ({ buildDailySummary: vi.fn(), formatDailySummary: vi.fn() }));
vi.mock('../../../services/ActivityRepository.js', () => ({ default: {} }));
vi.mock('../../../services/repositories/ObligationRepository.js', () => ({ default: {} }));
vi.mock('../../../services/repositories/PreferencesRepository.js', () => ({ default: {} }));
vi.mock('../../../services/repositories/TriggerRepository.js', () => ({ default: {} }));

import { executeActions } from '../../../services/triggers/execute.js';
import { TriggerContext } from '../../../services/triggers/context.js';

function ctx(fire_count: number): TriggerContext {
  return {
    user_id: 'u', now: new Date('2026-09-08T15:30:00Z'), event: { kind: 'manual' },
    matched: { app: { bundle_id: 'ig', app_name: 'Instagram', minutes: 25 } },
    prefs: { timezone: 'UTC', strictness: 0.5 } as never,
    trigger: { id: 't', name: 't', fire_count } as never,
    appLogs: () => [], labels: async () => ({}), obligationsDueWithin: async () => [], locationsContaining: async () => [],
    currentLocation: () => null, openActivityEntries: async () => [], healthMetric: () => null, userName: async () => 'hadi',
  } as unknown as TriggerContext;
}

beforeEach(() => { sendMessage.mockReset(); sendMessage.mockResolvedValue({ sent: true, message: { id: 'm', status: 'queued' } }); });

describe('notify_user', () => {
  const actions = [{ action: 'notify_user' as const, params: { message: 'a {{minutes}} {{app}}', messages: ['b {{app}}', 'c {{name}}'] } }];

  it('rotates variants by fire_count and renders templates', async () => {
    await executeActions(actions, ctx(0));
    await executeActions(actions, ctx(1));
    await executeActions(actions, ctx(2));
    await executeActions(actions, ctx(3));
    expect(sendMessage.mock.calls.map(c => (c[0] as { body: string }).body)).toEqual(['a 25 Instagram', 'b Instagram', 'c hadi', 'a 25 Instagram']);
  });

  it('reports budget/quiet refusals as not-ok without throwing', async () => {
    sendMessage.mockResolvedValue({ sent: false, reason: 'budget_exhausted' });
    const r = await executeActions(actions, ctx(0));
    expect(r).toEqual([{ action: 'notify_user', ok: false, detail: 'budget_exhausted' }]);
  });

  it('rejects malformed actions per item and keeps going', async () => {
    const r = await executeActions([{ action: 'nope', params: {} } as never, { action: 'log', params: { message: 'hi {{app}}' } }], ctx(0));
    expect(r[0]).toMatchObject({ action: 'nope', ok: false });
    expect(r[1]).toEqual({ action: 'log', ok: true });
  });
});
