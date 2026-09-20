import { describeFiring } from '../../../services/triggers/reason';

const NOW = new Date('2026-09-08T15:30:00Z');

describe('describeFiring', () => {
  it('names the app and the minutes', () => {
    expect(describeFiring({ event: 'app_usage', matched: { app: { app_name: 'Instagram', minutes: 32 } } }, NOW))
      .toBe('32 min on Instagram.');
  });

  it('joins the parts of a conjunction the way the condition read', () => {
    const line = describeFiring({
      event: 'app_usage',
      matched: {
        app: { app_name: 'TikTok', minutes: 20 },
        obligation_title: 'OS midterm',
        obligation_due: '2026-09-08T21:30:00Z',
      },
    }, NOW);
    expect(line).toBe('20 min on TikTok, and OS midterm is open (due in 6 hours).');
  });

  it('formats long sessions in hours', () => {
    expect(describeFiring({ matched: { app: { app_name: 'YouTube', minutes: 95 } } }, NOW)).toBe('1h 35m on YouTube.');
  });

  it('describes arrivals and departures', () => {
    expect(describeFiring({ matched: { location: { name: 'Library', event: 'enter' } } }, NOW)).toBe('you arrived at Library.');
    expect(describeFiring({ matched: { location: { name: 'Library', event: 'exit' } } }, NOW)).toBe('you left Library.');
  });

  it('describes a goal in minutes, not percentages', () => {
    expect(describeFiring({ matched: { goal: { title: 'reading', logged_minutes: 40, target_minutes: 180, percent: 22 } } }, NOW))
      .toBe('reading: 40 min of 3h.');
  });

  it('falls back to the event when nothing matched', () => {
    expect(describeFiring({ event: 'scheduled' }, NOW)).toBe('it was the scheduled time.');
    expect(describeFiring({ event: 'obligation' }, NOW)).toBe('something was coming due.');
    expect(describeFiring({}, NOW)).toBe('the rule matched.');
  });
});
