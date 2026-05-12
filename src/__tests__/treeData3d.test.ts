import { describe, expect, it, vi } from 'vitest';
import {
  loadTreeData3D,
  lonLatToUtm20N,
  selectionDetailsForFieldPoint,
  selectionDetailsForTree,
} from '../treeData3d';

const pointFeature = {
  type: 'Feature',
  properties: {
    Point_ID: 'TEST001',
    X: 364784.887,
    Y: 4958952.421,
    Ortho: 248.25,
    Sep: -21.121,
    SD_X: 0.562,
    SD_Y: 0.918,
    SD_Z: 0.951,
    ZONE_CODE: 1,
    COUNT: 16352,
    AREA: 7.055,
    MAJORITY: 6,
  },
  geometry: { type: 'Point', coordinates: [-64.7088031, 44.7711914, 0] },
};

const containingTreeFeature = {
  type: 'Feature',
  properties: {
    Class: 'Tree',
    Confidence: 8.3,
    Shape_Leng: 45.2,
    Shape_Area: 71.18,
    OBJECTID_1: 1,
    COUNT: 164798,
    AREA: 71.1,
    MAJORITY: 6,
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-64.7089, 44.7711],
      [-64.7087, 44.7711],
      [-64.7087, 44.7713],
      [-64.7089, 44.7713],
      [-64.7089, 44.7711],
    ]],
  },
};

const farTreeFeature = {
  type: 'Feature',
  properties: { Shape_Area: 8, Shape_Leng: 10, MAJORITY: 1, COUNT: 100, AREA: 8 },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-64.0, 44.0],
      [-63.999, 44.0],
      [-63.999, 44.001],
      [-64.0, 44.001],
      [-64.0, 44.0],
    ]],
  },
};

const leaflessTreeFeature = {
  type: 'Feature',
  properties: { Shape_Area: 12, Shape_Leng: 14, MAJORITY: 0, COUNT: 50, AREA: 12 },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-64.1, 44.1],
      [-64.099, 44.1],
      [-64.099, 44.101],
      [-64.1, 44.101],
      [-64.1, 44.1],
    ]],
  },
};

function response(json: unknown): Response {
  return { ok: true, json: async () => json } as Response;
}

describe('treeData3D', () => {
  it('projects lon/lat into local UTM-like scene coordinates', () => {
    const [x, y] = lonLatToUtm20N(-64.7088031, 44.7711914);
    expect(x).toBeGreaterThan(360000);
    expect(x).toBeLessThan(370000);
    expect(y).toBeGreaterThan(4950000);
  });

  it('loads trees, derives stable IDs, classes, and joins contained field points', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(response({ type: 'FeatureCollection', features: [pointFeature] }))
      .mockResolvedValueOnce(response({ type: 'FeatureCollection', features: [] }))
      .mockResolvedValueOnce(response({ type: 'FeatureCollection', features: [containingTreeFeature, farTreeFeature, leaflessTreeFeature] }));

    const data = await loadTreeData3D();
    expect(data.fieldPoints).toHaveLength(1);
    expect(data.trees).toHaveLength(3);
    expect(data.trees[0].id).toBe('area-2-tree-0001');
    expect(data.trees[0].stressClass).toBe('Green');
    expect(data.trees[0].joinedFieldPoint?.id).toBe('TEST001');
    expect(data.trees[1].joinedFieldPoint).toBeUndefined();
    expect(data.trees[2].stressClass).toBe('NoLeaf');
    expect(data.trees[2].classLabel).toBe('Leafless (NoLeaf)');
  });

  it('selection details contain field point data and no undefined/null text', () => {
    const point = {
      id: 'TEST001',
      stressClass: 'Green' as const,
      majorityCode: 6,
      lonLat: [-64.7, 44.7] as [number, number],
      scenePosition: [1, 2, 3] as [number, number, number],
      sourceProperties: pointFeature.properties,
    };
    const tree = {
      id: 'area-2-tree-0001',
      area: 2 as const,
      stressClass: 'Green' as const,
      majorityCode: 6,
      classLabel: 'Healthy (Green)',
      centroidLonLat: [-64.7, 44.7] as [number, number],
      scenePosition: [1, 2, 3] as [number, number, number],
      crownArea: 10,
      crownRadius: 2,
      height: 7,
      sourceLayer: 'Area 2 Classified Trees',
      sourceProperties: containingTreeFeature.properties,
      joinedFieldPoint: point,
      joinDistanceMeters: 0,
    };

    const text = JSON.stringify(selectionDetailsForTree(tree)) + JSON.stringify(selectionDetailsForFieldPoint(point));
    expect(text).toContain('TEST001');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
});
