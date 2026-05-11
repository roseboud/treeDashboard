import { describe, it, expect, vi } from 'vitest';
import { Map, View } from 'ol';
import { loadGeoJSON, treePopup, type Stats } from '../map2d';
import { Style } from 'ol/style';

const validGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { MAJORITY: 1, Confidence: 0.9, Shape_Area: 12.3, Shape_Leng: 8.4 },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
    },
  ],
};

function makeMap() {
  const target = document.createElement('div');
  target.getBoundingClientRect = () =>
    ({ width: 100, height: 100, top: 0, left: 0, bottom: 100, right: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return new Map({ target, view: new View({ center: [0, 0], zoom: 2 }) });
}

describe('loadGeoJSON', () => {
  it('adds layer and increments stats on valid GeoJSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validGeoJSON,
    } as Response);

    const map = makeMap();
    const stats: Stats = { treeCount: 0, pointCount: 0, contourCount: 0 };
    const statsEl = document.createElement('span');

    const layer = await loadGeoJSON(map, '/data/test.json', new Style(), treePopup, stats, statsEl);

    expect(layer).toBeDefined();
    expect(map.getLayers().getLength()).toBe(1);

    // Simulate caller behaviour: increment stats from resolved layer
    stats.treeCount += layer!.getSource()!.getFeatures().length;
    expect(stats.treeCount).toBe(1);
  });

  it('does not throw and leaves stats unchanged on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const map = makeMap();
    const stats: Stats = { treeCount: 0, pointCount: 0, contourCount: 0 };
    const statsEl = document.createElement('span');

    const layer = await loadGeoJSON(map, '/data/missing.json', new Style(), treePopup, stats, statsEl);

    expect(layer).toBeUndefined();
    expect(stats.treeCount).toBe(0);
    expect(stats.pointCount).toBe(0);
    expect(stats.contourCount).toBe(0);
  });
});
