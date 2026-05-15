import { classDescription, classKey, type StressClassKey } from './utils';

export interface TreeFeature3D {
  id: string;
  area: 1 | 2;
  stressClass: StressClassKey | 'Unknown';
  majorityCode: number | undefined;
  classLabel: string;
  centroidLonLat: [number, number];
  scenePosition: [number, number, number];
  crownArea: number;
  crownRadius: number;
  height: number;
  sourceLayer: string;
  sourceProperties: Record<string, unknown>;
  joinedFieldPoint?: FieldPoint3D;
  joinDistanceMeters?: number;
}

export interface FieldPoint3D {
  id: string;
  stressClass: StressClassKey | 'Unknown';
  majorityCode: number | undefined;
  lonLat: [number, number];
  scenePosition: [number, number, number];
  sourceProperties: Record<string, unknown>;
}

export interface SelectionDetails {
  type: 'tree' | 'field-point';
  title: string;
  groups: Array<{
    title: string;
    rows: Array<{ label: string; value: string }>;
  }>;
}

interface GeoJSONFeature {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates: unknown;
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  name?: string;
  features: GeoJSONFeature[];
}

const TREE_SOURCES = [
  { area: 1 as const, path: '/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_All.json', layer: 'Area 1 Classified Trees' },
  { area: 2 as const, path: '/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_All.json', layer: 'Area 2 Classified Trees' },
];

const CONTOUR_SOURCES: Record<1 | 2, string> = {
  1: '/GeoJson/Area1/Contour_Lines_1M_Area1.json',
  2: '/GeoJson/Area2/Contour_Lines_1M_Area2.json',
};

/** Fallback elevations per area (metres, from Potree bbox stats) used only when
 *  the contour lookup fails to find any nearby vertex. */
const AREA_FALLBACK_Z: Record<1 | 2, number> = {
  1: 203,   // Area 1 contours span 185–221 m; median ~203 m
  2: 234,   // Area 2 contours span 204–248 m; matches field-point Ortho mean
};

const FIELD_POINTS_PATH = '/GeoJson/Area2/Points_Area2_All.json';
const MAX_JOIN_DISTANCE_METERS = 10;

// ── Contour spatial grid ──────────────────────────────────────────────────────

/** Spatial hash grid for fast nearest-contour-vertex queries in lon/lat space. */
interface ContourGrid {
  cells: Map<string, Array<[number, number, number]>>; // key → [lon, lat, elev]
  cellSize: number;
}

/**
 * Build a spatial hash grid from contour line GeoJSON features.
 * cellSize ~0.0002° ≈ 15 m — small enough for sub-tree precision,
 * large enough that each cell holds ~70–100 vertices.
 */
function buildContourGrid(
  features: GeoJSONFeature[],
  cellSize = 0.0002
): ContourGrid {
  const cells = new Map<string, Array<[number, number, number]>>();

  function addVertex(lon: number, lat: number, elev: number): void {
    const cx = Math.floor(lon / cellSize);
    const cy = Math.floor(lat / cellSize);
    const key = `${cx},${cy}`;
    const cell = cells.get(key);
    if (cell) {
      cell.push([lon, lat, elev]);
    } else {
      cells.set(key, [[lon, lat, elev]]);
    }
  }

  function visitCoords(coords: unknown, elev: number): void {
    if (!Array.isArray(coords)) return;
    if (
      coords.length >= 2 &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      addVertex(coords[0], coords[1], elev);
      return;
    }
    coords.forEach((child) => visitCoords(child, elev));
  }

  for (const feature of features) {
    const elev = (feature.properties ?? {}).Contour as number | undefined;
    if (typeof elev !== 'number') continue;
    visitCoords(feature.geometry?.coordinates, elev);
  }

  return { cells, cellSize };
}

/**
 * Return the elevation of the nearest contour vertex within a 3×3 cell
 * neighbourhood, or `undefined` if the area has no contour data nearby.
 */
function nearestContourElevation(
  lon: number,
  lat: number,
  grid: ContourGrid
): number | undefined {
  const { cells, cellSize } = grid;
  const cx = Math.floor(lon / cellSize);
  const cy = Math.floor(lat / cellSize);

  let bestElev: number | undefined;
  let bestDistSq = Infinity;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cell = cells.get(`${cx + dx},${cy + dy}`);
      if (!cell) continue;
      for (const [vlon, vlat, elev] of cell) {
        const dSq = (lon - vlon) * (lon - vlon) + (lat - vlat) * (lat - vlat);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestElev = elev;
        }
      }
    }
  }

  return bestElev;
}

function numberProp(properties: Record<string, unknown>, key: string): number | undefined {
  const value = properties[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringProp(properties: Record<string, unknown>, key: string): string | undefined {
  const value = properties[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function stressFromMajority(code: number | undefined): StressClassKey | 'Unknown' {
  // The split NoLeaf layer uses code 5, while the aggregate tree layers in this dataset use 0.
  if (code === 0) return 'NoLeaf';
  return classKey(code) ?? 'Unknown';
}

function classDescriptionFor3D(code: number | undefined): string {
  if (code === 0) return 'Leafless (NoLeaf)';
  return classDescription(code);
}

function collectPositions(coordinates: unknown, positions: Array<[number, number]>): void {
  if (!Array.isArray(coordinates)) return;
  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number'
  ) {
    positions.push([coordinates[0], coordinates[1]]);
    return;
  }
  coordinates.forEach((child) => collectPositions(child, positions));
}

function centroidFromGeometry(feature: GeoJSONFeature): [number, number] | undefined {
  const positions: Array<[number, number]> = [];
  collectPositions(feature.geometry?.coordinates, positions);
  if (positions.length === 0) return undefined;

  const sum = positions.reduce((acc, position) => {
    acc[0] += position[0];
    acc[1] += position[1];
    return acc;
  }, [0, 0]);
  return [sum[0] / positions.length, sum[1] / positions.length];
}

function firstRing(feature: GeoJSONFeature): Array<[number, number]> {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  const polygon = feature.geometry?.type === 'MultiPolygon' ? coordinates[0] : coordinates;
  if (!Array.isArray(polygon) || !Array.isArray(polygon[0])) return [];
  return polygon[0].filter((position): position is [number, number] =>
    Array.isArray(position) && typeof position[0] === 'number' && typeof position[1] === 'number'
  );
}

function pointInRing(point: [number, number], ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function lonLatToUtm20N(lon: number, lat: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e = Math.sqrt(f * (2 - f));
  const eSq = e * e;
  const ePrimeSq = eSq / (1 - eSq);
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const lonOriginRad = (-63) * Math.PI / 180;
  const n = a / Math.sqrt(1 - eSq * Math.sin(latRad) ** 2);
  const t = Math.tan(latRad) ** 2;
  const c = ePrimeSq * Math.cos(latRad) ** 2;
  const aa = Math.cos(latRad) * (lonRad - lonOriginRad);
  const m = a * (
    (1 - eSq / 4 - 3 * eSq ** 2 / 64 - 5 * eSq ** 3 / 256) * latRad -
    (3 * eSq / 8 + 3 * eSq ** 2 / 32 + 45 * eSq ** 3 / 1024) * Math.sin(2 * latRad) +
    (15 * eSq ** 2 / 256 + 45 * eSq ** 3 / 1024) * Math.sin(4 * latRad) -
    (35 * eSq ** 3 / 3072) * Math.sin(6 * latRad)
  );
  const x = k0 * n * (aa + (1 - t + c) * aa ** 3 / 6 + (5 - 18 * t + t ** 2 + 72 * c - 58 * ePrimeSq) * aa ** 5 / 120) + 500000;
  const y = k0 * (m + n * Math.tan(latRad) * (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24 + (61 - 58 * t + t ** 2 + 600 * c - 330 * ePrimeSq) * aa ** 6 / 720));
  return [x, y];
}

function fieldPointFromFeature(feature: GeoJSONFeature, index: number): FieldPoint3D | undefined {
  const properties = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') return undefined;
  const pointId = stringProp(properties, 'Point_ID') ?? stringProp(properties, 'Point_ID_1') ?? `field-point-${index + 1}`;
  const majorityCode = numberProp(properties, 'MAJORITY');
  const [x, y] = lonLatToUtm20N(coordinates[0], coordinates[1]);
  const z = numberProp(properties, 'Ortho') ?? 230;
  return {
    id: pointId,
    stressClass: stressFromMajority(majorityCode),
    majorityCode,
    lonLat: [coordinates[0], coordinates[1]],
    scenePosition: [x, y, z],
    sourceProperties: properties,
  };
}

function distanceMeters(a: [number, number], b: [number, number]): number {
  const au = lonLatToUtm20N(a[0], a[1]);
  const bu = lonLatToUtm20N(b[0], b[1]);
  return Math.hypot(au[0] - bu[0], au[1] - bu[1]);
}

function nearestFieldPoint(
  treeFeature: GeoJSONFeature,
  centroid: [number, number],
  points: FieldPoint3D[]
): { point: FieldPoint3D; distance: number } | undefined {
  const ring = firstRing(treeFeature);
  const contained = ring.length > 2 ? points.find((point) => pointInRing(point.lonLat, ring)) : undefined;
  if (contained) return { point: contained, distance: 0 };

  let nearest: { point: FieldPoint3D; distance: number } | undefined;
  points.forEach((point) => {
    const distance = distanceMeters(centroid, point.lonLat);
    if (!nearest || distance < nearest.distance) nearest = { point, distance };
  });
  return nearest && nearest.distance <= MAX_JOIN_DISTANCE_METERS ? nearest : undefined;
}

function treeFromFeature(
  feature: GeoJSONFeature,
  index: number,
  area: 1 | 2,
  sourceLayer: string,
  fieldPoints: FieldPoint3D[],
  contourGrid: ContourGrid
): TreeFeature3D | undefined {
  const centroid = centroidFromGeometry(feature);
  if (!centroid) return undefined;

  const properties = feature.properties ?? {};
  const majorityCode = numberProp(properties, 'MAJORITY');
  const crownArea = numberProp(properties, 'Shape_Area') ?? numberProp(properties, 'AREA') ?? 6;
  const stressClass = stressFromMajority(majorityCode);
  const [x, y] = lonLatToUtm20N(centroid[0], centroid[1]);

  // Z priority:
  //   1. Joined field-point Ortho (GPS-measured ground truth, Area 2 only)
  //   2. Nearest contour line vertex elevation (1 m contours, both areas)
  //   3. Per-area statistical fallback
  const joined = area === 2 ? nearestFieldPoint(feature, centroid, fieldPoints) : undefined;
  const z =
    joined?.point.scenePosition[2] ??
    nearestContourElevation(centroid[0], centroid[1], contourGrid) ??
    AREA_FALLBACK_Z[area];

  return {
    id: `area-${area}-tree-${String(index + 1).padStart(4, '0')}`,
    area,
    stressClass,
    majorityCode,
    classLabel: classDescriptionFor3D(majorityCode),
    centroidLonLat: centroid,
    scenePosition: [x, y, z],
    crownArea,
    crownRadius: Math.max(Math.sqrt(crownArea / Math.PI), 1.2),
    height: Math.min(Math.max(4 + Math.sqrt(crownArea), 5), 16),
    sourceLayer,
    sourceProperties: properties,
    joinedFieldPoint: joined?.point,
    joinDistanceMeters: joined?.distance,
  };
}

async function fetchGeoJSON(path: string): Promise<GeoJSONFeatureCollection> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json() as GeoJSONFeatureCollection;
}

export async function loadTreeData3D(): Promise<{ trees: TreeFeature3D[]; fieldPoints: FieldPoint3D[] }> {
  // Load field points and contour grids in parallel — all are needed before trees
  const [fieldJson, contourJson1, contourJson2] = await Promise.all([
    fetchGeoJSON(FIELD_POINTS_PATH),
    fetchGeoJSON(CONTOUR_SOURCES[1]),
    fetchGeoJSON(CONTOUR_SOURCES[2]),
  ]);

  const fieldPoints = fieldJson.features
    .map((feature, index) => fieldPointFromFeature(feature, index))
    .filter((point): point is FieldPoint3D => Boolean(point));

  const contourGrids: Record<1 | 2, ContourGrid> = {
    1: buildContourGrid(contourJson1.features),
    2: buildContourGrid(contourJson2.features),
  };

  const treeCollections = await Promise.all(TREE_SOURCES.map(async (source) => ({
    source,
    json: await fetchGeoJSON(source.path),
  })));

  const trees = treeCollections.flatMap(({ source, json }) =>
    json.features
      .map((feature, index) =>
        treeFromFeature(feature, index, source.area, source.layer, fieldPoints, contourGrids[source.area])
      )
      .filter((tree): tree is TreeFeature3D => Boolean(tree))
  );

  return { trees, fieldPoints };
}

function display(value: unknown, digits = 2): string {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(digits);
  if (typeof value === 'string' && value.trim()) return value;
  return 'N/A';
}

export function selectionDetailsForTree(tree: TreeFeature3D): SelectionDetails {
  const rows = [
    { label: 'Tree ID', value: tree.id },
    { label: 'Area', value: `Area ${tree.area}` },
    { label: 'Class', value: tree.classLabel },
    { label: 'MAJORITY', value: display(tree.majorityCode, 0) },
    { label: 'Confidence', value: display(tree.sourceProperties.Confidence) },
    { label: 'Shape_Area', value: display(tree.sourceProperties.Shape_Area) },
    { label: 'Shape_Leng', value: display(tree.sourceProperties.Shape_Leng) },
    { label: 'COUNT', value: display(tree.sourceProperties.COUNT, 0) },
    { label: 'Raster AREA', value: display(tree.sourceProperties.AREA) },
    { label: 'Source', value: tree.sourceLayer },
  ];

  const groups = [{ title: 'Crown', rows }];
  if (tree.joinedFieldPoint) {
    groups.push({
      title: 'Matched Tested Tree',
      rows: fieldPointRows(tree.joinedFieldPoint).concat([
        { label: 'Join distance', value: `${display(tree.joinDistanceMeters)} m` },
      ]),
    });
  }
  return { type: 'tree', title: tree.id, groups };
}

function fieldPointRows(point: FieldPoint3D): Array<{ label: string; value: string }> {
  return [
    { label: 'Point_ID', value: point.id },
    { label: 'Class', value: classDescription(point.majorityCode) },
    { label: 'MAJORITY', value: display(point.majorityCode, 0) },
    { label: 'Ortho', value: display(point.sourceProperties.Ortho) },
    { label: 'Sep', value: display(point.sourceProperties.Sep) },
    { label: 'SD_X', value: display(point.sourceProperties.SD_X) },
    { label: 'SD_Y', value: display(point.sourceProperties.SD_Y) },
    { label: 'SD_Z', value: display(point.sourceProperties.SD_Z) },
    { label: 'X', value: display(point.sourceProperties.X) },
    { label: 'Y', value: display(point.sourceProperties.Y) },
    { label: 'ZONE_CODE', value: display(point.sourceProperties.ZONE_CODE, 0) },
    { label: 'COUNT', value: display(point.sourceProperties.COUNT, 0) },
    { label: 'AREA', value: display(point.sourceProperties.AREA) },
  ];
}

export function selectionDetailsForFieldPoint(point: FieldPoint3D): SelectionDetails {
  return { type: 'field-point', title: point.id, groups: [{ title: 'Tested Tree Point', rows: fieldPointRows(point) }] };
}
