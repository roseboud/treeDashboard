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

  // All singleband COGs use normalize:false so band(1) returns the raw stored value.
  // Without this, OL can fall back to the float32 type range (+/-3.4e38) when a COG
  // lacks embedded min/max statistics, collapsing every pixel to 0 (solid black).
  const rawSource = new GeoTIFF({ sources: [{ url: entry.path }], normalize: false });

  const labelLower  = entry.label.toLowerCase();
  const isNDVI      = labelLower.includes('ndvi');
  const isLeafClass = labelLower.includes('leaf');
  const isAspect    = labelLower.includes('aspect');
  const classColor  = isLeafClass ? leafClassColor(entry.label) : undefined;

  let color: ExpressionValue;

  if (isNDVI) {
    color = ['case', ['>', ['band', 1], 0],
      ['interpolate', ['linear'], ['band', 1],
        0, [255, 255, 255, 1],
        1, [255, 0,   0,   1],
      ],
      [0, 0, 0, 0],
    ];
  } else if (classColor) {
    const [r, g, b] = classColor;
    color = ['case', ['>', ['band', 1], 0],
      [r, g, b, 0.80],
      [0, 0, 0, 0],
    ];
  } else if (isAspect) {
    // Aspect stores azimuth as float32 0-360 degrees (flat areas = -1 in GDAL).
    // Directional colours: N=blue, E=yellow, S=red-orange, W=green.
    color = ['case', ['>', ['band', 1], 0],
      ['interpolate', ['linear'], ['band', 1],
          0.001, [100, 140, 220, 0.85],
         90,     [220, 185,   0, 0.85],
        180,     [200,  70,  40, 0.85],
        270,     [ 40, 160,  80, 0.85],
        360,     [100, 140, 220, 0.85],
      ],
      [0, 0, 0, 0],
    ];
  } else {
    // Generic singleband (hillshade uint8 0-255, slope, DEM hillshade, stream).
    color = ['case', ['>', ['band', 1], 0],
      ['interpolate', ['linear'], ['band', 1],
        1,   [1,   1,   1,   0.85],
        255, [255, 255, 255, 0.85],
      ],
      [0, 0, 0, 0],
    ];
  }

  return new WebGLTileLayer({ source: rawSource, style: { color } });
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
