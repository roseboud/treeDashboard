import { Map, View, Overlay, Feature } from 'ol';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import type { StyleLike } from 'ol/style/Style';
import type { FeatureLike } from 'ol/Feature';
import { GeoJSON } from 'ol/format';
import { classColor, classDescription, STRESS_COLORS } from './utils';

export type PopupFn = (feature: Feature) => string;

export interface Stats {
  treeCount: number;
  pointCount: number;
  contourCount: number;
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

export async function loadGeoJSON(
  map: Map,
  url: string,
  style: StyleLike,
  popupFn: PopupFn,
  stats: Stats,
  statsEl: HTMLElement
): Promise<VectorLayer | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`GeoJSON fetch failed: ${url} (${res.status})`);
      return undefined;
    }
    const json = await res.json();
    const source = new VectorSource({
      features: new GeoJSON().readFeatures(json, { featureProjection: 'EPSG:3857' }),
    });

    const layer = new VectorLayer({
      source,
      style,
    });
    map.addLayer(layer);

    return layer;
  } catch (err) {
    console.warn(`GeoJSON error: ${url}`, err);
    return undefined;
  }
}

export function initMap2D(mapEl: HTMLElement, statsEl: HTMLElement): Map {
  const map = new Map({
    target: mapEl,
    layers: [
      new TileLayer({
        source: new OSM(),
      }),
    ],
    view: new View({
      center: fromLonLat([-64.5, 45.1]),
      zoom: 16,
    }),
  });

  // Popup overlay
  const popupOverlay = new Overlay({
    element: document.getElementById('popup')!,
    autoPan: true,
  });
  map.addOverlay(popupOverlay);

  const popupContent = document.getElementById('popup-content')!;
  const popupCloser = document.getElementById('popup-closer')!;

  popupCloser.addEventListener('click', (e) => {
    e.preventDefault();
    popupOverlay.setPosition(undefined);
  });

  map.on('singleclick', (evt) => {
    const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
    if (feature) {
      // Determine popup type by geometry
      const geom = (feature as import('ol').Feature).getGeometry();
      const type = geom?.getType();
      let html = '';
      if (type === 'Point' || type === 'MultiPoint') {
        html = pointPopup(feature as import('ol').Feature);
      } else if (type === 'Polygon' || type === 'MultiPolygon') {
        html = treePopup(feature as import('ol').Feature);
      } else {
        html = contourPopup(feature as import('ol').Feature);
      }
      popupContent.innerHTML = html;
      popupOverlay.setPosition(evt.coordinate);
    } else {
      popupOverlay.setPosition(undefined);
    }
  });

  // Stats
  const stats: Stats = { treeCount: 0, pointCount: 0, contourCount: 0 };

  // Layer toggle panel
  const panel = document.getElementById('layer-panel')!;

  const area1TreeFiles = [
    { url: '/data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Green.json', name: 'Area 1 - Healthy (Green)', color: STRESS_COLORS.Green },
    { url: '/data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Yellow.json', name: 'Area 1 - Mild Stress', color: STRESS_COLORS.Yellow },
    { url: '/data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Orange.json', name: 'Area 1 - Moderate Stress', color: STRESS_COLORS.Orange },
    { url: '/data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Red.json', name: 'Area 1 - High Stress', color: STRESS_COLORS.Red },
    { url: '/data/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Cyan_NoLeaf.json', name: 'Area 1 - Leafless', color: STRESS_COLORS.NoLeaf },
  ];

  const area2TreeFiles = [
    { url: '/data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Green.json', name: 'Area 2 - Healthy (Green)', color: STRESS_COLORS.Green },
    { url: '/data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Yellow.json', name: 'Area 2 - Mild Stress', color: STRESS_COLORS.Yellow },
    { url: '/data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Orange.json', name: 'Area 2 - Moderate Stress', color: STRESS_COLORS.Orange },
    { url: '/data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Red.json', name: 'Area 2 - High Stress', color: STRESS_COLORS.Red },
    { url: '/data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Cyan_NoLeaf.json', name: 'Area 2 - Leafless', color: STRESS_COLORS.NoLeaf },
  ];

  const contourFiles = [
    { url: '/data/GeoJson/Area1/Contour_Lines_1M_Area1.json', name: 'Area 1 - Contours' },
    { url: '/data/GeoJson/Area2/Contour_Lines_1M_Area2.json', name: 'Area 2 - Contours' },
  ];

  const pointFiles = [
    { url: '/data/GeoJson/Area2/Points_Area2_All.json', name: 'Area 2 - Field Points' },
  ];

  const allEntries: { url: string; name: string; color?: string; isContour?: boolean; isPoint?: boolean }[] = [
    ...area1TreeFiles,
    ...area2TreeFiles,
    ...pointFiles.map((p) => ({ ...p, isPoint: true })),
    ...contourFiles.map((c) => ({ ...c, isContour: true })),
  ];

  const layers: VectorLayer[] = [];

  allEntries.forEach((entry) => {
    const wrapper = document.createElement('div');
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + entry.name));
    wrapper.appendChild(label);
    panel.appendChild(wrapper);

    let style: StyleLike;
    if (entry.isContour) {
      style = new Style({
        stroke: new Stroke({ color: '#555', width: 0.5 }),
      });
    } else if (entry.isPoint) {
      style = defaultPointStyle;
    } else {
      style = new Style({
        fill: new Fill({ color: entry.color || '#999' }),
        stroke: new Stroke({ color: entry.color || '#999', width: 1 }),
      });
    }

    loadGeoJSON(map, entry.url, style, entry.isPoint ? pointPopup : entry.isContour ? contourPopup : treePopup, stats, statsEl).then((layer) => {
      if (layer) {
        cb.addEventListener('change', () => layer.setVisible(cb.checked));
        layers.push(layer);

        if (entry.isPoint) stats.pointCount += (layer.getSource()?.getFeatures().length ?? 0);
        else if (entry.isContour) stats.contourCount += (layer.getSource()?.getFeatures().length ?? 0);
        else stats.treeCount += (layer.getSource()?.getFeatures().length ?? 0);
        statsEl.textContent = `Trees: ${stats.treeCount}  |  Points: ${stats.pointCount}  |  Contours: ${stats.contourCount}`;

        if (!entry.isContour && !entry.isPoint) {
          const extent = layer.getSource()?.getExtent();
          if (extent) {
            map.getView().fit(extent, { padding: [40, 40, 40, 40] });
          }
        }
      }
    });
  });

  // Legend
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = '<b>Leaf Stress</b><br>';
  for (const [label, color] of Object.entries(STRESS_COLORS)) {
    legend.innerHTML += `<span class="swatch" style="background:${color}"></span> ${label}<br>`;
  }
  mapEl.appendChild(legend);

  return map;
}

export function treePopup(feature: import('ol').Feature): string {
  const p = feature.getProperties();
  const code = p.MAJORITY as number | null | undefined;
  return (
    '<b>Tree Polygon</b><br>' +
    'Tree Condition: ' + classDescription(code) + '<br>' +
    'Class Code: ' + (code != null ? String(code) : 'N/A') + '<br>' +
    'Confidence: ' + (p.Confidence != null ? ((p.Confidence as number) * 100).toFixed(1) + '%' : 'N/A') + '<br>' +
    'Area: ' + (p.Shape_Area != null ? (p.Shape_Area as number).toFixed(2) + ' m²' : 'N/A') + '<br>' +
    'Perimeter: ' + (p.Shape_Leng != null ? (p.Shape_Leng as number).toFixed(2) + ' m' : 'N/A')
  );
}

export function pointPopup(feature: import('ol').Feature): string {
  const p = feature.getProperties();
  const code = p.MAJORITY as number | null | undefined;
  return (
    '<b>Field Point: ' + (p.Point_ID != null ? String(p.Point_ID) : 'N/A') + '</b><br>' +
    'Tree Classification: ' + classDescription(code) + '<br>' +
    'Class Code: ' + (code != null ? String(code) : 'N/A') + '<br>' +
    'Ortho Height: ' + (p.Ortho != null ? (p.Ortho as number).toFixed(1) + ' m' : 'N/A') + '<br>' +
    'X: ' + (p.X != null ? (p.X as number).toFixed(1) : 'N/A') + '<br>' +
    'Y: ' + (p.Y != null ? (p.Y as number).toFixed(1) : 'N/A')
  );
}

export function contourPopup(feature: import('ol').Feature): string {
  const p = feature.getProperties();
  return '<b>Contour Line</b><br>Elevation: ' + (p.Contour != null ? String(p.Contour) : 'N/A') + ' m';
}
