import { mechanicalChecks, RUBRIC, VOICE_CASES, VOICES } from '../../../evals/voiceCases';

const kase = VOICE_CASES.find(c => c.id === 'deadline_drift')!;

const ok = (checks: ReturnType<typeof mechanicalChecks>, id: string) => checks.find(c => c.id === id)!.ok;

describe('eval cases', () => {
  it('has ten situations and five voices with unique ids', () => {
    expect(VOICE_CASES).toHaveLength(10);
    expect(VOICES).toHaveLength(5);
    expect(new Set(VOICE_CASES.map(c => c.id)).size).toBe(10);
    expect(RUBRIC.filter(r => r.critical).length).toBeGreaterThanOrEqual(4);
  });

  it('every case explains what it tests', () => {
    for (const c of VOICE_CASES) expect(c.about.length).toBeGreaterThan(10);
  });
});

describe('mechanicalChecks', () => {
  it('passes a good rewrite', () => {
    const checks = mechanicalChecks('20 min on tiktok and the os midterm is in 6 hours. what\'s the plan?', kase);
    expect(checks.every(c => c.ok)).toBe(true);
  });

  it('catches a dropped fact', () => {
    const checks = mechanicalChecks('you have a midterm soon. get off your phone.', kase);
    expect(ok(checks, 'keeps_facts')).toBe(false);
    expect(checks.find(c => c.id === 'keeps_facts')!.detail).toMatch(/tiktok/);
  });

  it('catches an essay', () => {
    const long = 'you have spent twenty minutes on tiktok today and your os midterm is due in 6 hours, which means '
      + 'you should probably think carefully about how you want the rest of this evening to go, because the time '
      + 'you have left is not very much at all and it is going to disappear faster than you expect it to.';
    expect(ok(mechanicalChecks(long, kase), 'short')).toBe(false);
  });

  it('catches markdown and empty output', () => {
    expect(ok(mechanicalChecks('- tiktok: 20 min\n- os midterm: 6 hours', kase), 'no_markdown')).toBe(false);
    expect(ok(mechanicalChecks('   ', kase), 'not_empty')).toBe(false);
  });
});
