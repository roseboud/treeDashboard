import { describe, it, expect } from 'vitest';
import { classColor, classDescription } from '../utils';

describe('classColor', () => {
  it('maps all 5 known codes to correct hex', () => {
    expect(classColor(1)).toBe('#e74c3c'); // Red
    expect(classColor(2)).toBe('#e67e22'); // Orange
    expect(classColor(3)).toBe('#f1c40f'); // Yellow
    expect(classColor(5)).toBe('#3498db'); // NoLeaf
    expect(classColor(6)).toBe('#2ecc71'); // Green
  });

  it('returns #999 for unknown code', () => {
    expect(classColor(99)).toBe('#999');
    expect(classColor(undefined)).toBe('#999');
    expect(classColor(null)).toBe('#999');
  });
});

describe('classDescription', () => {
  it('maps all 5 known codes to correct label', () => {
    expect(classDescription(1)).toBe('High Stress (Red)');
    expect(classDescription(2)).toBe('Moderate Stress (Orange)');
    expect(classDescription(3)).toBe('Mild Stress (Yellow)');
    expect(classDescription(5)).toBe('Leafless (NoLeaf)');
    expect(classDescription(6)).toBe('Healthy (Green)');
  });

  it('returns Unknown (N) for unknown code', () => {
    expect(classDescription(99)).toBe('Unknown (99)');
    expect(classDescription(undefined)).toBe('Unknown (N)');
    expect(classDescription(null)).toBe('Unknown (N)');
  });
});
