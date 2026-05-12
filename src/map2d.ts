import { Map, View, Overlay, Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import type { Extent } from 'ol/extent';
import { createEmpty, extend, isEmpty } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import type { StyleLike } from 'ol/style/Style';
import type { FeatureLike } from 'ol/Feature';
import { GeoJSON } from 'ol/format';
import { VECTOR_CATALOG, type AreaId, type StressClass, type VectorCatalogEntry } from './catalog';
import { classColor, classDescription, classKey, STRESS_COLORS, STRESS_CLASS_ORDER } from './utils';

export type PopupFn = (feature: Feature<Geometry>) => string;

export interface Stats {
  treeCount: number;
  pointCount: number;
  contourCount: number;
  stressCounts: Record<StressClass, number>;
}

export interface LoadedVectorLayer {
  entry: VectorCatalogEntry;
  layer: VectorLayer<VectorSource<Feature<Geometry>>>;
  features: Feature<Geometry>[];
  extent: Extent;
}

interface LayerRecord extends LoadedVectorLayer {
  checkbox: HTMLInputElement;
  userVisible: boolean;
}

interface FilterState {
  areas: Set<AreaId>;
  stressClasses: Set<StressClass>;
}

interface CoordinateContainingGeometry extends Geometry {
  intersectsCoordinate(coordinate: Coordinate): boolean;
}

function requireElement<T extends HTMLElement>(id: string, type: { new(): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Missing required dashboard element: #${id}`);
  }
  return element;
}

function formatNumber(value: unknown, digits: number, suffix = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : 'N/A';
}

function formatPercent(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'N/A';
}

function defaultPointStyle(feature: FeatureLike): Style {
  const f = feature instanceof Feature ? feature : undefined;
  const code = f ? (f.get('MAJORITY') as number | undefined) : undefined;
  return new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: classColor(code) }),
      stroke: new Stroke({ color: '#000', width: 2 }),
    }),
  });
}

function treeStyle(entry: VectorCatalogEntry): StyleLike {
  if (entry.stressClass) {
    const color = STRESS_COLORS[entry.stressClass];
    return new Style({
      fill: new Fill({ color: `${color}99` }),
      stroke: new Stroke({ color, width: 1 }),
    });
  }

  return (feature: FeatureLike) => {
    const code = feature instanceof Feature ? (feature.get('MAJORITY') as number | undefined) : undefined;
    const color = classColor(code);
    return new Style({
      fill: new Fill({ color: `${color}66` }),
      stroke: new Stroke({ color, width: 1 }),
    });
  };
}

function styleForEntry(entry: VectorCatalogEntry): StyleLike {
  if (entry.kind === 'contour') {
    return new Style({ stroke: new Stroke({ color: '#555', width: 0.6 }) });
  }
  if (entry.kind === 'point') {
    return defaultPointStyle;
  }
  return treeStyle(entry);
}

function popupForGeometry(feature: Feature<Geometry>): string {
  const type = feature.getGeometry()?.getType();
  if (type === 'Point' || type === 'MultiPoint') return pointPopup(feature);
  if (type === 'Polygon' || type === 'MultiPolygon') return treePopup(feature);
  return contourPopup(feature);
}

function isCoordinateContainingGeometry(geometry: Geometry | undefined): geometry is CoordinateContainingGeometry {
  const candidate = geometry as Partial<CoordinateContainingGeometry> | undefined;
  return typeof candidate?.intersectsCoordinate === 'function';
}

export async function loadGeoJSON(
  map: Map,
  entry: VectorCatalogEntry,
  style: StyleLike = styleForEntry(entry)
): Promise<LoadedVectorLayer | undefined> {
  try {
    const res = await fetch(entry.path);
    if (!res.ok) {
      console.warn(`GeoJSON fetch failed: ${entry.path} (${res.status})`);
      return undefined;
    }

    const json: unknown = await res.json();
    const features = new GeoJSON().readFeatures(json, { featureProjection: 'EPSG:3857' }) as Feature<Geometry>[];
    const source = new VectorSource({ features });
    const layer = new VectorLayer({ source, style });
    layer.setVisible(entry.defaultVisible);
    map.addLayer(layer);

    return { entry, layer, features, extent: source.getExtent() ?? createEmpty() };
  } catch (err) {
    console.warn(`GeoJSON error: ${entry.path}`, err);
    return undefined;
  }
}

export function initMap2D(mapEl: HTMLElement, statsEl: HTMLElement): Map {
  const map = new Map({
    target: mapEl,
    layers: [new TileLayer({ source: new OSM() })],
    view: new View({
      center: fromLonLat([-64.5, 45.1]),
      zoom: 16,
    }),
  });

  const popupOverlay = new Overlay({
    element: requireElement('popup', HTMLElement),
    autoPan: true,
    stopEvent: false,
  });
  map.addOverlay(popupOverlay);

  const popupContent = requireElement('popup-content', HTMLElement);
  const popupCloser = requireElement('popup-closer', HTMLAnchorElement);
  popupCloser.addEventListener('click', (e) => {
    e.preventDefault();
    popupOverlay.setPosition(undefined);
  });

  map.on('singleclick', (evt) => {
    const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
    if (feature instanceof Feature) {
      popupContent.innerHTML = popupForGeometry(feature as Feature<Geometry>);
      popupOverlay.setPosition(evt.coordinate);
    } else {
      popupOverlay.setPosition(undefined);
    }
  });

  const panel = requireElement('layer-panel', HTMLElement);
  const validationContent = document.getElementById('validation-content');
  const records: LayerRecord[] = [];
  const filterState: FilterState = {
    areas: new Set<AreaId>([1, 2]),
    stressClasses: new Set<StressClass>(STRESS_CLASS_ORDER),
  };
  const stats: Stats = {
    treeCount: 0,
    pointCount: 0,
    contourCount: 0,
    stressCounts: { Green: 0, Yellow: 0, Orange: 0, Red: 0, NoLeaf: 0 },
  };

  function entryPassesFilters(entry: VectorCatalogEntry): boolean {
    if (!filterState.areas.has(entry.area)) return false;
    if ((entry.kind === 'tree' || entry.kind === 'point') && entry.stressClass) {
      return filterState.stressClasses.has(entry.stressClass);
    }
    return true;
  }

  function applyFilters(): void {
    records.forEach((record) => {
      record.layer.setVisible(record.userVisible && entryPassesFilters(record.entry));
    });
    updateStats();
  }

  function updateStats(): void {
    const visibleRecords = records.filter((record) => record.userVisible && entryPassesFilters(record.entry));
    const treeCount = visibleRecords
      .filter((record) => record.entry.kind === 'tree' && !record.entry.aggregate)
      .reduce((sum, record) => sum + record.features.length, 0);
    const pointCount = visibleRecords
      .filter((record) => record.entry.kind === 'point' && record.entry.aggregate)
      .reduce((sum, record) => sum + record.features.length, 0);
    const contourCount = visibleRecords
      .filter((record) => record.entry.kind === 'contour')
      .reduce((sum, record) => sum + record.features.length, 0);

    const stressCounts = { Green: 0, Yellow: 0, Orange: 0, Red: 0, NoLeaf: 0 };
    visibleRecords.forEach((record) => {
      if (record.entry.kind === 'tree' && record.entry.stressClass && !record.entry.aggregate) {
        stressCounts[record.entry.stressClass] += record.features.length;
      }
    });

    Object.assign(stats, { treeCount, pointCount, contourCount, stressCounts });
    const stressText = STRESS_CLASS_ORDER
      .map((key) => {
        const percent = treeCount > 0 ? Math.round((stressCounts[key] / treeCount) * 100) : 0;
        return `${key}: ${stressCounts[key]} (${percent}%)`;
      })
      .join(' | ');
    statsEl.textContent = `Trees: ${treeCount} | Points: ${pointCount} | Contours: ${contourCount} | ${stressText}`;
  }

  function updateValidation(): void {
    if (!validationContent) return;
    const pointRecord = records.find((record) => record.entry.id === 'a2-points-all');
    const treeRecords = records.filter((record) => record.entry.area === 2 && record.entry.kind === 'tree' && record.entry.stressClass && !record.entry.aggregate);

    if (!pointRecord || treeRecords.length === 0) {
      validationContent.textContent = 'Waiting for Area 2 field points and tree classes...';
      return;
    }

    let matched = 0;
    let sameClass = 0;
    let differentClass = 0;
    const pointCounts = { Green: 0, Yellow: 0, Orange: 0, Red: 0, NoLeaf: 0 };

    pointRecord.features.forEach((point) => {
      const pointClass = classKey(point.get('MAJORITY') as number | null | undefined);
      if (pointClass) pointCounts[pointClass] += 1;
      const coordinate = point.getGeometry()?.getType() === 'Point'
        ? (point.getGeometry() as Geometry & { getCoordinates(): Coordinate }).getCoordinates()
        : undefined;
      if (!coordinate) return;

      const containingRecord = treeRecords.find((record) =>
        record.features.some((tree) => {
          const geometry = tree.getGeometry();
          return isCoordinateContainingGeometry(geometry) && geometry.intersectsCoordinate(coordinate);
        })
      );
      if (!containingRecord) return;

      matched += 1;
      if (pointClass && containingRecord.entry.stressClass === pointClass) sameClass += 1;
      else differentClass += 1;
    });

    const distribution = STRESS_CLASS_ORDER.map((key) => `${key}: ${pointCounts[key]}`).join(' | ');
    validationContent.innerHTML = `
      <strong>Area 2 field points</strong>
      <span>${pointRecord.features.length} points loaded</span>
      <span>${distribution}</span>
      <span>${matched} points fall inside classified crowns; ${sameClass} match crown class, ${differentClass} differ.</span>
    `;
  }

  function wireFilterControls(): void {
    document.querySelectorAll<HTMLInputElement>('[data-area-filter]').forEach((input) => {
      input.addEventListener('change', () => {
        const area = Number(input.dataset.areaFilter) as AreaId;
        if (input.checked) filterState.areas.add(area);
        else filterState.areas.delete(area);
        applyFilters();
      });
    });

    document.querySelectorAll<HTMLInputElement>('[data-stress-filter]').forEach((input) => {
      input.addEventListener('change', () => {
        const stressClass = input.dataset.stressFilter as StressClass;
        if (input.checked) filterState.stressClasses.add(stressClass);
        else filterState.stressClasses.delete(stressClass);
        applyFilters();
      });
    });
  }

  const combinedExtent = createEmpty();
  let completedLoads = 0;
  let failedLoads = 0;
  statsEl.textContent = `Loading GeoJSON layers... 0 / ${VECTOR_CATALOG.length}`;

  const loadPromises = VECTOR_CATALOG.map(async (entry) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'layer-row';
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = entry.defaultVisible;
    cb.disabled = !entry.available;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${entry.label}`));
    wrapper.appendChild(label);
    panel.appendChild(wrapper);

    if (!entry.available) {
      wrapper.classList.add('is-disabled');
      wrapper.title = `Unavailable asset: ${entry.path}`;
      label.appendChild(document.createTextNode(' (unavailable)'));
      return;
    }

    const loaded = await loadGeoJSON(map, entry);
    completedLoads += 1;
    if (!loaded) {
      failedLoads += 1;
      cb.checked = false;
      cb.disabled = true;
      wrapper.classList.add('is-disabled');
      wrapper.title = `Failed to load ${entry.path}`;
      label.appendChild(document.createTextNode(' (failed)'));
      statsEl.textContent = `Loading GeoJSON layers... ${completedLoads} / ${VECTOR_CATALOG.length} | Failed: ${failedLoads}`;
      return;
    }

    const record: LayerRecord = { ...loaded, checkbox: cb, userVisible: cb.checked };
    records.push(record);
    cb.addEventListener('change', () => {
      record.userVisible = cb.checked;
      applyFilters();
    });

    if ((entry.kind === 'tree' || entry.kind === 'point') && !isEmpty(loaded.extent)) {
      extend(combinedExtent, loaded.extent);
    }
    applyFilters();
    updateValidation();
  });

  Promise.all(loadPromises).then(() => {
    if (!isEmpty(combinedExtent)) {
      map.getView().fit(combinedExtent, { padding: [50, 50, 50, 50], maxZoom: 17 });
    }
    applyFilters();
    updateValidation();
  }).catch((error: unknown) => {
    console.warn('GeoJSON layer initialization failed', error);
  });

  wireFilterControls();

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = '<b>Leaf Stress</b><br>';
  STRESS_CLASS_ORDER.forEach((label) => {
    legend.innerHTML += `<span class="swatch" style="background:${STRESS_COLORS[label]}"></span> ${label}<br>`;
  });
  mapEl.appendChild(legend);

  return map;
}

export function treePopup(feature: Feature<Geometry>): string {
  const p = feature.getProperties();
  const code = p.MAJORITY as number | null | undefined;
  return (
    '<b>Tree Polygon</b><br>' +
    'Tree Condition: ' + classDescription(code) + '<br>' +
    'Class Code: ' + (code != null ? String(code) : 'N/A') + '<br>' +
    'Confidence: ' + formatPercent(p.Confidence) + '<br>' +
    'Area: ' + formatNumber(p.Shape_Area, 2, ' m²') + '<br>' +
    'Perimeter: ' + formatNumber(p.Shape_Leng, 2, ' m')
  );
}

export function pointPopup(feature: Feature<Geometry>): string {
  const p = feature.getProperties();
  const code = p.MAJORITY as number | null | undefined;
  return (
    '<b>Field Point: ' + (p.Point_ID != null ? String(p.Point_ID) : 'N/A') + '</b><br>' +
    'Tree Classification: ' + classDescription(code) + '<br>' +
    'Class Code: ' + (code != null ? String(code) : 'N/A') + '<br>' +
    'Ortho Height: ' + formatNumber(p.Ortho, 1, ' m') + '<br>' +
    'X: ' + formatNumber(p.X, 1) + '<br>' +
    'Y: ' + formatNumber(p.Y, 1)
  );
}

export function contourPopup(feature: Feature<Geometry>): string {
  const p = feature.getProperties();
  return '<b>Contour Line</b><br>Elevation: ' + (p.Contour != null ? String(p.Contour) : 'N/A') + ' m';
}
