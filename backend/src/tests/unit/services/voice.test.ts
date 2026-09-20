import { vi } from 'vitest';

vi.mock('../../../services/repositories/MessageRepository.js', () => ({ default: { recent: vi.fn(async () => []) } }));

import { setVoiceProviderForTests, voiceHints, voiceRewrite, VOICE_GUIDES, VoiceProvider } from '../../../services/messaging/voice';
import { TriggerContext } from '../../../services/triggers/context';
import { UserPreferences } from '../../../types/user/UserPreferences';

function ctx(over: { sleep?: number | null; voice?: string; voice_guide?: string | null } = {}): TriggerContext {
  return {
    user_id: 'u',
    now: new Date('2026-09-08T15:30:00Z'),
    event: { kind: 'manual' },
    matched: {},
    prefs: UserPreferences.parse({
      user_id: '11111111-1111-4111-8111-111111111111',
      timezone: 'UTC',
      voice: over.voice ?? 'older_sibling',
      voice_guide: over.voice_guide ?? null,
    }),
    healthMetric: () => (over.sleep === undefined ? null : over.sleep),
    userName: async () => 'hadi',
  } as unknown as TriggerContext;
}

afterEach(() => setVoiceProviderForTests(undefined));

describe('voiceHints', () => {
  it('adds a tired hint under the sleep threshold', () => {
    const hints = voiceHints(ctx({ sleep: 240 }));
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatch(/4h/);
    expect(hints[0]).toMatch(/gentler/i);
  });

  it('says nothing on a full night or with no data', () => {
    expect(voiceHints(ctx({ sleep: 480 }))).toEqual([]);
    expect(voiceHints(ctx())).toEqual([]);
  });
});

describe('voiceRewrite', () => {
  it('passes the stored guide for own_voice and returns the rewrite', async () => {
    const rewrite = vi.fn<VoiceProvider['rewrite']>(async () => 'rewritten');
    setVoiceProviderForTests({ rewrite });
    const out = await voiceRewrite('30 min on Instagram. you good?', ctx({ voice: 'own_voice', voice_guide: 'all lowercase, no periods', sleep: 200 }));
    expect(out).toBe('rewritten');
    const args = rewrite.mock.calls[0]![0];
    expect(args.guide).toBe('all lowercase, no periods');
    expect(args.hints?.[0]).toMatch(/gentler/i);
  });

  it('sends no guide when the user has not produced one', async () => {
    const rewrite = vi.fn<VoiceProvider['rewrite']>(async () => 'rewritten');
    setVoiceProviderForTests({ rewrite });
    await voiceRewrite('hi', ctx({ voice: 'own_voice' }));
    expect(rewrite.mock.calls[0]![0].guide).toBeUndefined();
    expect(VOICE_GUIDES.own_voice).toBeTruthy();
  });

  it('falls back to the template when the provider fails', async () => {
    setVoiceProviderForTests({ rewrite: async () => { throw new Error('nope'); } });
    expect(await voiceRewrite('plain text', ctx())).toBe('plain text');
  });

  it('returns the template unchanged with no provider', async () => {
    setVoiceProviderForTests(null);
    expect(await voiceRewrite('plain text', ctx())).toBe('plain text');
  });
});
