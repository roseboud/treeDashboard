import { describe, it, expect, vi } from 'vitest';
import { Map, View } from 'ol';
import { loadGeoJSON } from '../map2d';
import { Style } from 'ol/style';
import type { VectorCatalogEntry } from '../catalog';

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
  const entry: VectorCatalogEntry = {
    id: 'test-tree',
    label: 'Test Tree',
    area: 1,
    kind: 'tree',
    path: '/GeoJson/test.json',
    defaultVisible: true,
    available: true,
    stressClass: 'Red',
  };

  it('adds layer and returns loaded features on valid GeoJSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validGeoJSON,
    } as Response);

    const map = makeMap();

    const loaded = await loadGeoJSON(map, entry, new Style());

    expect(loaded).toBeDefined();
    expect(map.getLayers().getLength()).toBe(1);
    expect(loaded!.features).toHaveLength(1);
    expect(loaded!.entry.id).toBe('test-tree');
  });

  it('does not throw and returns undefined on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const map = makeMap();

    const loaded = await loadGeoJSON(map, { ...entry, path: '/GeoJson/missing.json' }, new Style());

    expect(loaded).toBeUndefined();
    expect(map.getLayers().getLength()).toBe(0);
  });
});
