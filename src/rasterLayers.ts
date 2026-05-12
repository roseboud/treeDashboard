import { Map as OLMap } from 'ol';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import GeoTIFF from 'ol/source/GeoTIFF';
import { RASTER_CATALOG, type RasterCatalogEntry } from './catalog';

export { RASTER_CATALOG };
export type { RasterCatalogEntry };

export type DisposeRasterPanel = () => void;

function createRasterLayer(entry: RasterCatalogEntry): WebGLTileLayer {
  if (entry.kind === 'rgb') {
    return new WebGLTileLayer({
      source: new GeoTIFF({ sources: [{ url: entry.path }] }),
    });
  }

  const isNDVI = entry.label.toLowerCase().includes('ndvi');
  const color = isNDVI
    ? ['interpolate', ['linear'], ['band', 1], 0, [255, 255, 255], 1, [255, 0, 0]]
    : ['interpolate', ['linear'], ['band', 1], 0, [0, 0, 0], 255, [255, 255, 255]];

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
