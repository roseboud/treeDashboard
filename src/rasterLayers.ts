import { Map as OLMap } from 'ol';
import type { ExpressionValue } from 'ol/expr/expression';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import GeoTIFF from 'ol/source/GeoTIFF';
import { RASTER_CATALOG, type RasterCatalogEntry } from './catalog';
import { STRESS_COLORS } from './utils';

export { RASTER_CATALOG };
export type { RasterCatalogEntry };

export type DisposeRasterPanel = () => void;

const BACKGROUND_LABELS = ['Hillshade', 'DEM Hillshade', 'Slope', 'Aspect', 'Stream'];

function isBackground(entry: RasterCatalogEntry): boolean {
  return BACKGROUND_LABELS.some((label) => entry.label.includes(label.split(' ')[0]));
}

function isLeafOverlay(entry: RasterCatalogEntry): boolean {
  return entry.label.toLowerCase().includes('leaf');
}

/**
 * Maps a label keyword to an RGBA color used as the "active pixel" tint for
 * leaf-classification single-band rasters.  The rasters are binary masks
 * (non-zero = classified), so we render 0 as transparent and the class color
 * at full opacity.  Colors match the STRESS_COLORS palette in utils.ts.
 */
const LEAF_CLASS_COLORS: Array<{ keyword: string; rgba: [number, number, number, number] }> = [
  { keyword: 'green',    rgba: [58,  158, 79,  1] },
  { keyword: 'yellow',   rgba: [212, 160, 23,  1] },
  { keyword: 'orange',   rgba: [204, 85,  0,   1] },
  { keyword: 'red',      rgba: [176, 28,  28,  1] },
  { keyword: 'leafless', rgba: [42,  138, 138, 1] },
  { keyword: 'noleaf',   rgba: [42,  138, 138, 1] },
  { keyword: 'teal',     rgba: [42,  138, 138, 1] },
];

function leafClassColor(label: string): [number, number, number, number] | undefined {
  const lower = label.toLowerCase();
  return LEAF_CLASS_COLORS.find(({ keyword }) => lower.includes(keyword))?.rgba;
}

function createRasterLayer(entry: RasterCatalogEntry): WebGLTileLayer {
  if (entry.kind === 'rgb') {
    return new WebGLTileLayer({
      source: new GeoTIFF({ sources: [{ url: entry.path }] }),
    });
  }

  // OL WebGL style expressions require 4-element [r, g, b, a] color arrays
  // (r/g/b 0–255, a 0–1).  The missing alpha was a silent rendering bug.
  const isNDVI       = entry.label.toLowerCase().includes('ndvi');
  const isLeafClass  = entry.label.toLowerCase().includes('leaf');
  const classColor   = isLeafClass ? leafClassColor(entry.label) : undefined;

  let color: ExpressionValue;
  if (isNDVI) {
    // NDVI: transparent no-data, then white (low) → red (high); input range 0–1
    color = ['case', ['>', ['band', 1], 0],
      ['interpolate', ['linear'], ['band', 1],
        0, [255, 255, 255, 1],
        1, [255, 0,   0,   1],
      ],
      [0, 0, 0, 0],
    ];
  } else if (classColor) {
    // Leaf-classification binary mask: transparent background, class color for hits
    const [r, g, b] = classColor;
    color = ['case', ['>', ['band', 1], 0],
      [r, g, b, 0.80],   // classified pixel — stress-class color, slightly transparent
      [0, 0, 0, 0],       // background — fully transparent
    ];
  } else {
    // Generic singleband (hillshade, slope, aspect, DEM, stream…):
    // transparent no-data, then greyscale ramp. This prevents COG extents from
    // painting black rectangles over the basemap where source pixels are empty.
    color = ['case', ['>', ['band', 1], 0],
      ['interpolate', ['linear'], ['band', 1],
        1,   [1,   1,   1,   0.85],
        255, [255, 255, 255, 0.85],
      ],
      [0, 0, 0, 0],
    ];
  }

  return new WebGLTileLayer({
    source: new GeoTIFF({ sources: [{ url: entry.path }] }),
    style: { color },
  });
}

export function addRasterLayerPanel(map: OLMap, panelEl: HTMLElement): DisposeRasterPanel {
  const cache = new globalThis.Map<string, WebGLTileLayer>();
  const cleanups: Array<() => void> = [];
  const availableBackgrounds = RASTER_CATALOG.filter((entry) => entry.available && isBackground(entry));
  const leafOverlays = RASTER_CATALOG.filter((entry) => isLeafOverlay(entry));

  const status = document.createElement('div');
  status.className = 'panel-status';
  status.textContent = 'Choose one background context and any leaf overlays.';
  panelEl.appendChild(status);

  const legend = document.createElement('div');
  legend.className = 'panel-status raster-legend-row';
  const legendEntries: Array<[string, string]> = [
    ['Green', 'Green'],
    ['Yellow', 'Yellow'],
    ['Orange', 'Orange'],
    ['Red', 'Red'],
    ['NoLeaf', 'NoLeaf'],
  ];
  legendEntries.forEach(([key, labelText]) => {
    const item = document.createElement('span');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = STRESS_COLORS[key];
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(labelText));
    legend.appendChild(item);
  });
  panelEl.appendChild(legend);

  function layerFor(entry: RasterCatalogEntry): WebGLTileLayer {
    let layer = cache.get(entry.path);
    if (!layer) {
      layer = createRasterLayer(entry);
      layer.setVisible(false);
      cache.set(entry.path, layer);
      map.addLayer(layer);
    }
    return layer;
  }

  function setEntryVisible(entry: RasterCatalogEntry, visible: boolean): void {
    layerFor(entry).setVisible(visible);
  }

  const contextSection = document.createElement('div');
  contextSection.className = 'panel-section';
  const contextTitle = document.createElement('strong');
  contextTitle.textContent = 'Background Context';
  contextSection.appendChild(contextTitle);

  const noneLabel = document.createElement('label');
  const noneRadio = document.createElement('input');
  noneRadio.type = 'radio';
  noneRadio.name = 'context-layer';
  noneRadio.value = '';
  noneLabel.appendChild(noneRadio);
  noneLabel.appendChild(document.createTextNode(' None'));
  contextSection.appendChild(noneLabel);
  const onNoneChange = () => {
    if (!noneRadio.checked) return;
    availableBackgrounds.forEach((entry) => {
      const layer = cache.get(entry.path);
      if (layer) layer.setVisible(false);
    });
    status.textContent = 'Background context hidden';
  };
  noneRadio.addEventListener('change', onNoneChange);
  cleanups.push(() => noneRadio.removeEventListener('change', onNoneChange));

  const defaultBackground = availableBackgrounds.find((entry) => entry.defaultVisible) ?? availableBackgrounds[0];
  availableBackgrounds.forEach((entry) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'layer-row';
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'context-layer';
    radio.value = entry.path;
    radio.checked = entry === defaultBackground;
    label.appendChild(radio);
    label.appendChild(document.createTextNode(` ${entry.label.replace(/^Area ([12]) /, '$&- ')}`));
    wrapper.appendChild(label);
    contextSection.appendChild(wrapper);

    const onChange = () => {
      if (!radio.checked) return;
      availableBackgrounds.forEach((candidate) => {
        const layer = cache.get(candidate.path);
        if (layer) layer.setVisible(false);
      });
      setEntryVisible(entry, true);
      status.textContent = `${entry.label} enabled`;
    };
    radio.addEventListener('change', onChange);
    cleanups.push(() => radio.removeEventListener('change', onChange));
  });
  noneRadio.checked = !defaultBackground;
  panelEl.appendChild(contextSection);
  if (defaultBackground) {
    setEntryVisible(defaultBackground, true);
  }

  const overlaySection = document.createElement('div');
  overlaySection.className = 'panel-section';
  const overlayTitle = document.createElement('strong');
  overlayTitle.textContent = 'Leaf Classification Overlays';
  overlaySection.appendChild(overlayTitle);

  leafOverlays.forEach((entry) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'layer-row';
    const label = document.createElement('label');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    const classColor = leafClassColor(entry.label);
    if (classColor) swatch.style.background = `rgb(${classColor[0]}, ${classColor[1]}, ${classColor[2]})`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = entry.defaultVisible;
    cb.disabled = !entry.available;
    label.appendChild(swatch);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${entry.label.replace(/^Area ([12]) Leaf /, 'Area $1 - ')}`));
    wrapper.appendChild(label);
    overlaySection.appendChild(wrapper);

    if (!entry.available) {
      wrapper.classList.add('is-disabled');
      wrapper.title = `Unavailable asset: ${entry.path}`;
      label.appendChild(document.createTextNode(' (unavailable)'));
      return;
    }

    const onChange = () => {
      setEntryVisible(entry, cb.checked);
      status.textContent = `${entry.label} ${cb.checked ? 'enabled' : 'hidden'}`;
    };
    cb.addEventListener('change', onChange);
    cleanups.push(() => cb.removeEventListener('change', onChange));
    if (entry.defaultVisible) onChange();
  });
  panelEl.appendChild(overlaySection);

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    cache.forEach((layer) => {
      map.removeLayer(layer);
      layer.dispose();
    });
    cache.clear();
  };
}
