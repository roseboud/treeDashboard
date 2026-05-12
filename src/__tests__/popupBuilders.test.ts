import { describe, it, expect } from 'vitest';
import { Feature } from 'ol';
import { treePopup, pointPopup, contourPopup } from '../map2d';

describe('treePopup', () => {
  it('renders fully populated properties', () => {
    const f = new Feature({
      MAJORITY: 1,
      Confidence: 0.85,
      Shape_Area: 10.5,
      Shape_Leng: 8.2,
    });
    const html = treePopup(f);
    expect(html).toContain('High Stress');
    expect(html).toContain('1');
    expect(html).toContain('85.0%');
    expect(html).toContain('10.50 m²');
    expect(html).toContain('8.20 m');
  });

  it('contains no literal undefined or null when props missing', () => {
    const f = new Feature({});
    const html = treePopup(f);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });
});

describe('pointPopup', () => {
  it('renders fully populated properties', () => {
    const f = new Feature({
      Point_ID: 42,
      MAJORITY: 6,
      Ortho: 5.5,
      X: 100.1,
      Y: 200.2,
    });
    const html = pointPopup(f);
    expect(html).toContain('Field Point: 42');
    expect(html).toContain('Healthy');
    expect(html).toContain('5.5 m');
    expect(html).toContain('100.1');
    expect(html).toContain('200.2');
  });

  it('contains no literal undefined or null when props missing', () => {
    const f = new Feature({});
    const html = pointPopup(f);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });
});

describe('contourPopup', () => {
  it('renders fully populated properties', () => {
    const f = new Feature({ Contour: 123 });
    const html = contourPopup(f);
    expect(html).toContain('123');
    expect(html).toContain('Elevation');
  });

  it('contains no literal undefined or null when props missing', () => {
    const f = new Feature({});
    const html = contourPopup(f);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });
});
