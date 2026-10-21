import { describe, expect, it } from 'vitest';
import { holidays, submitDeadline } from './deadline.js';

describe('lhůta pro vyúčtování (10 pracovních dnů)', () => {
  it('Velikonoce 2026: Velký pátek 3. 4. a Velikonoční pondělí 6. 4.', () => {
    const h = holidays(2026);
    expect(h.has('2026-04-03')).toBe(true);
    expect(h.has('2026-04-06')).toBe(true);
    expect(h.has('2026-10-28')).toBe(true);
  });

  it('počítá jen pracovní dny a přeskakuje svátky', () => {
    // Konec v pátek 16. 10. 2026; 28. 10. je svátek → pondělí 2. 11.
    expect(submitDeadline('2026-10-16T18:30')).toBe('2026-11-02');
    // Konec v pátek 18. 12. 2026; 24., 25. 12. a 1. 1. jsou svátky → středa 6. 1. 2027
    expect(submitDeadline('2026-12-18')).toBe('2027-01-06');
    expect(submitDeadline('')).toBe('');
  });
});
