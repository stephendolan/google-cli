import { describe, it, expect } from 'vitest';
import { normalizeRangeBound } from './calendar-client.js';

describe('normalizeRangeBound', () => {
  it('passes through timestamps that already have a time component', () => {
    expect(normalizeRangeBound('2026-04-01T00:00:00Z', 'start')).toBe('2026-04-01T00:00:00Z');
    expect(normalizeRangeBound('2026-04-01T09:30:00-04:00', 'end')).toBe('2026-04-01T09:30:00-04:00');
  });

  it('expands a bare start date to a valid RFC3339 timestamp', () => {
    const result = normalizeRangeBound('2026-04-01', 'start');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(result).getTime()).not.toBeNaN();
  });

  it('makes a bare end date inclusive of the named day', () => {
    const start = new Date(normalizeRangeBound('2026-06-30', 'start')).getTime();
    const end = new Date(normalizeRangeBound('2026-06-30', 'end')).getTime();
    expect(end - start).toBe(24 * 60 * 60 * 1000);
  });

  it('trims surrounding whitespace before interpreting the input', () => {
    expect(normalizeRangeBound('  2026-04-01T00:00:00Z  ', 'start')).toBe('2026-04-01T00:00:00Z');
    expect(() => normalizeRangeBound('  2026-04-01  ', 'end')).not.toThrow();
  });

  it('rejects malformed dates with a helpful error', () => {
    expect(() => normalizeRangeBound('june 1', 'start')).toThrow(/Invalid date/);
  });

  it('rejects numerically-valid-looking but impossible dates instead of rolling them over', () => {
    // 2026-13-01 would roll to 2027-01-01 and 2026-02-30 to 2026-03-02 via the
    // Date constructor, silently querying the wrong range — must throw instead.
    expect(() => normalizeRangeBound('2026-13-01', 'start')).toThrow(/Invalid date/);
    expect(() => normalizeRangeBound('2026-02-30', 'start')).toThrow(/Invalid date/);
  });
});
