import { describe, it, expect } from 'vitest';
import { durationTicks, formatAxisDuration, formatDuration, formatHour, formatRelative } from './format';

describe('formatDuration', () => {
  it('scales from seconds to hours', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(754)).toBe('13m');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(7980)).toBe('2h 13m');
  });
});

describe('durationTicks', () => {
  it('uses round steps and covers the max', () => {
    expect(durationTicks(0)).toEqual([0, 60]);
    expect(durationTicks(1500)).toEqual([0, 600, 1200, 1800]);
    expect(durationTicks(5000)).toEqual([0, 1800, 3600, 5400]);
    const big = durationTicks(20 * 3600);
    expect(big[big.length - 1]).toBeGreaterThanOrEqual(20 * 3600);
    expect(big.length).toBeLessThanOrEqual(5);
  });

  it('formats ticks compactly', () => {
    expect(formatAxisDuration(0)).toBe('0');
    expect(formatAxisDuration(1800)).toBe('30m');
    expect(formatAxisDuration(5400)).toBe('1.5h');
    expect(formatAxisDuration(7200)).toBe('2h');
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  const ago = (sec: number) => new Date(now - sec * 1000).toISOString();

  it('steps up a unit once rounding reaches it', () => {
    expect(formatRelative(null, now)).toBe('Never');
    expect(formatRelative(ago(20), now)).toBe('just now');
    expect(formatRelative(ago(59.6 * 60), now)).toMatch(/hour/);
    expect(formatRelative(ago(23.8 * 3600), now)).toMatch(/yesterday|1 day/);
    expect(formatRelative(ago(10 * 86_400), now)).toMatch(/week/);
    expect(formatRelative(ago(45 * 86_400), now)).toMatch(/month/);
  });
});

describe('formatHour', () => {
  it('uses 12-hour clock labels', () => {
    expect(formatHour(0)).toBe('12 AM');
    expect(formatHour(9)).toBe('9 AM');
    expect(formatHour(12)).toBe('12 PM');
    expect(formatHour(21)).toBe('9 PM');
  });
});
