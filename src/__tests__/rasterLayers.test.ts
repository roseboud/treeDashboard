import { describe, it, expect } from 'vitest';
import { addRasterLayerPanel } from '../rasterLayers';

describe('addRasterLayerPanel', () => {
  it('does not add a second layer when enabling twice', () => {
    const layers: unknown[] = [];
    const map = {
      addLayer: (l: unknown) => layers.push(l),
      getLayers: () => ({ getLength: () => layers.length }),
    } as unknown as import('ol').Map;

    const panel = document.createElement('div');
    addRasterLayerPanel(map, panel);

    const cb = panel.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb).toBeDefined();

    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    const afterFirst = map.getLayers().getLength();

    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    const afterSecond = map.getLayers().getLength();

    expect(afterFirst).toBe(afterSecond);
  });
});
