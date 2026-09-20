import { adaptBudget } from '../../../services/messaging/budget';

const signals = (over: Partial<Parameters<typeof adaptBudget>[1]> = {}) =>
  ({ nudges: 0, ignored: 0, acks: 0, due_soon: 0, ...over });

describe('adaptBudget', () => {
  it('spends what the user set when there is no signal', () => {
    expect(adaptBudget(4, signals())).toEqual({ budget: 4, effective: 4, reason: 'as_set' });
  });

  it('halves it when nudges are being ignored', () => {
    expect(adaptBudget(4, signals({ nudges: 4, ignored: 4 }))).toEqual({ budget: 4, effective: 2, reason: 'mostly_ignored' });
    expect(adaptBudget(5, signals({ nudges: 4, ignored: 3 }))).toEqual({ budget: 5, effective: 3, reason: 'mostly_ignored' });
  });

  it('takes one off when the replies are bare acks', () => {
    expect(adaptBudget(4, signals({ nudges: 4, ignored: 0, acks: 3 }))).toEqual({ budget: 4, effective: 3, reason: 'mostly_acked' });
  });

  it('spends the whole budget when something is due', () => {
    expect(adaptBudget(4, signals({ nudges: 4, ignored: 4, due_soon: 1 }))).toEqual({ budget: 4, effective: 4, reason: 'deadline' });
  });

  it('never goes above what the user set, or below one', () => {
    expect(adaptBudget(2, signals({ nudges: 6, ignored: 6 })).effective).toBe(1);
    expect(adaptBudget(1, signals({ nudges: 6, ignored: 6 })).effective).toBe(1);
    expect(adaptBudget(0, signals({ due_soon: 3 })).effective).toBe(0);
    expect(adaptBudget(10, signals({ due_soon: 3 })).effective).toBe(10);
  });

  it('waits for enough nudges before judging', () => {
    expect(adaptBudget(4, signals({ nudges: 2, ignored: 2 })).reason).toBe('as_set');
  });
});
