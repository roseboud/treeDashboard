import { describe, it, expect, vi } from 'vitest';
import { addRasterLayerPanel, RASTER_CATALOG } from '../rasterLayers';

const disposeMock = vi.fn();
const setVisibleMock = vi.fn();

vi.mock('ol/source/GeoTIFF', () => ({
  default: class GeoTIFFMock {
    options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  },
}));

vi.mock('ol/layer/WebGLTile', () => ({
  default: class WebGLTileMock {
    setVisible = setVisibleMock;
    dispose = disposeMock;
  },
}));

describe('addRasterLayerPanel', () => {
  it('does not add a second layer when enabling twice', () => {
    const layers: unknown[] = [];
    const map = {
      addLayer: (l: unknown) => layers.push(l),
      removeLayer: (l: unknown) => {
        const index = layers.indexOf(l);
        if (index >= 0) layers.splice(index, 1);
      },
      getLayers: () => ({ getLength: () => layers.length }),
    } as unknown as import('ol').Map;

    const panel = document.createElement('div');
    addRasterLayerPanel(map, panel);

    const cb = Array.from(panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((input) => !input.disabled);
    expect(cb).toBeDefined();

    cb!.checked = true;
    cb!.dispatchEvent(new Event('change'));
    const afterFirst = map.getLayers().getLength();

    cb!.checked = true;
    cb!.dispatchEvent(new Event('change'));
    const afterSecond = map.getLayers().getLength();

    expect(afterFirst).toBe(afterSecond);
  });

  it('disables unavailable raster entries', () => {
    const map = {
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
    } as unknown as import('ol').Map;
    const panel = document.createElement('div');

    addRasterLayerPanel(map, panel);

    const unavailableCount = RASTER_CATALOG.filter((entry) => !entry.available).length;
    const disabledInputs = panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:disabled');
    expect(disabledInputs).toHaveLength(unavailableCount);
    expect(panel.textContent).toContain('unavailable');
  });

  it('removes and disposes cached layers during cleanup', () => {
    const layers: unknown[] = [];
    const map = {
      addLayer: (l: unknown) => layers.push(l),
      removeLayer: (l: unknown) => {
        const index = layers.indexOf(l);
        if (index >= 0) layers.splice(index, 1);
      },
    } as unknown as import('ol').Map;
    const panel = document.createElement('div');
    const dispose = addRasterLayerPanel(map, panel);
    const cb = Array.from(panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((input) => !input.disabled);

    cb!.checked = true;
    cb!.dispatchEvent(new Event('change'));
    expect(layers).toHaveLength(1);

    dispose();
    expect(layers).toHaveLength(0);
    expect(disposeMock).toHaveBeenCalled();
  });
});
