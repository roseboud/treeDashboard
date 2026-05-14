import { Map as OLMap } from 'ol';
import type { ExpressionValue } from 'ol/expr/expression';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import GeoTIFF from 'ol/source/GeoTIFF';
import { RASTER_CATALOG, type RasterCatalogEntry } from './catalog';

export { RASTER_CATALOG };
export type { RasterCatalogEntry };

export type DisposeRasterPanel = () => void;

/**
 * Maps a label keyword to an RGBA color used as the "active pixel" tint for
 * leaf-classification single-band rasters.  The rasters are binary masks
 * (non-zero = classified), so we render 0 as transparent and the class color
 * at full opacity.  Colors match the STRESS_COLORS palette in utils.ts.
 */
const LEAF_CLASS_COLORS: Array<{ keyword: string; rgba: [number, number, number, number] }> = [
  { keyword: 'green',    rgba: [46,  204, 113, 1] },
  { keyword: 'yellow',   rgba: [241, 196, 15,  1] },
  { keyword: 'orange',   rgba: [230, 126, 34,  1] },
  { keyword: 'red',      rgba: [231, 76,  60,  1] },
  { keyword: 'leafless', rgba: [52,  152, 219, 1] },
  { keyword: 'noleaf',   rgba: [52,  152, 219, 1] },
  { keyword: 'teal',     rgba: [52,  152, 219, 1] },
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
    // NDVI: white (low) → red (high); input range 0–1
    color = ['interpolate', ['linear'], ['band', 1],
      0, [255, 255, 255, 1],
      1, [255, 0,   0,   1],
    ];
  } else if (classColor) {
    // Leaf-classification binary mask: transparent background, class color for hits
    const [r, g, b] = classColor;
    color = ['case', ['>', ['band', 1], 0],
      [r, g, b, 0.80],   // classified pixel — stress-class color, slightly transparent
      [0, 0, 0, 0],       // background — fully transparent
    ];
  } else {
    // Generic singleband (hillshade, slope, aspect, DEM, stream…): greyscale ramp
    color = ['interpolate', ['linear'], ['band', 1],
      0,   [0,   0,   0,   1],
      255, [255, 255, 255, 1],
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
  const availableCount = RASTER_CATALOG.filter((entry) => entry.available).length;

  const status = document.createElement('div');
  status.className = 'panel-status';
  status.textContent = `Raster layers ready (${availableCount} available, ${RASTER_CATALOG.length - availableCount} unavailable)`;
  panelEl.appendChild(status);

  RASTER_CATALOG.forEach((entry) => {
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
    panelEl.appendChild(wrapper);

    if (!entry.available) {
      wrapper.classList.add('is-disabled');
      wrapper.title = `Unavailable asset: ${entry.path}`;
      label.appendChild(document.createTextNode(' (unavailable)'));
      return;
    }

    const onChange = () => {
      if (cb.checked) {
        status.textContent = `Loading ${entry.label}...`;
        let layer = cache.get(entry.path);
        if (!layer) {
          layer = createRasterLayer(entry);
          layer.setVisible(true);
          cache.set(entry.path, layer);
          map.addLayer(layer);
        } else {
          layer.setVisible(true);
        }
        status.textContent = `${entry.label} enabled`;
      } else {
        const layer = cache.get(entry.path);
        if (layer) layer.setVisible(false);
        status.textContent = `${entry.label} hidden`;
      }
    };

    cb.addEventListener('change', onChange);
    cleanups.push(() => cb.removeEventListener('change', onChange));
    if (entry.defaultVisible) onChange();
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    cache.forEach((layer) => {
      map.removeLayer(layer);
      layer.dispose();
    });
    cache.clear();
  };
}
