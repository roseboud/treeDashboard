import { Map as OLMap } from 'ol';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import GeoTIFF from 'ol/source/GeoTIFF';

export interface RasterEntry {
  label: string;
  path: string;
  area: 1 | 2;
  type: 'rgb' | 'singleband';
}

export const RASTER_CATALOG: RasterEntry[] = [
  // Area 1
  { label: 'Area1 NDVI', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutchinson_APT_Area1_NDVI_FORCED_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Hillshade', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutch_Section1_Hillshade_ForContours_clipped_FORCED_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Slope', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutch_Section1_Slope_clipped_FORCED_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Aspect', path: '/COGs_Tiff/Mercator_Versions/Area1/Hutch_Section1_Aspect_clipped_FORCED_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 RGB Part1', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutchinson_Area1_L2_Photo_RGB_NoHoleFilling_Fill_RC_Ortho_Cog_part1.tif', area: 1, type: 'rgb' },
  { label: 'Area1 RGB Part2', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutchinson_Area1_L2_Photo_RGB_NoHoleFilling_Fill_RC_Ortho_Cog_part2.tif', area: 1, type: 'rgb' },
  { label: 'Area1 DEM Hillshade', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutchinson_Section1_DEM_50cm_Class2-3_Hillshade_Clipped_FORCED_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Stream', path: '/COGs_Tiff/Mercator_Versions/Area1/Stream_Area1_clipped_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Leaf Green', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_Green_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Leaf Leafless', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_LeaflessTeal_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Leaf Orange', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_Orange_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Leaf Red', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_Red_Cog.tif', area: 1, type: 'singleband' },
  { label: 'Area1 Leaf Yellow', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_Yellow_Cog.tif', area: 1, type: 'singleband' },

  // Area 2
  { label: 'Area2 NDVI', path: '/COGs_Tiff/Mercator_Versions/Area2/20250919_Hutchinson_APT_Area2_NDVI_FORCED_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Hillshade', path: '/COGs_Tiff/Mercator_Versions/Area2/HillShade_Hutch_Area2_ForStream_clipped_FORCED_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Slope', path: '/COGs_Tiff/Mercator_Versions/Area2/20250919_Hutch_Section2_Slope_clipped_FORCED_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Aspect', path: '/COGs_Tiff/Mercator_Versions/Area2/Aspect_Section2_clipped_FORCED_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 RGB', path: '/COGs_Tiff/Mercator_Versions/Area2/20250919_Hutchinson_Area2_L2_RGB_Ortho_Cog.tif', area: 2, type: 'rgb' },
  { label: 'Area2 DEM Hillshade', path: '/COGs_Tiff/Mercator_Versions/Area2/20250919_Hutchinson_Section2_DEM_50cm_Class2-3_Hillshade_Clipped_FORCED_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Stream', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_Hutch_Stream_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Leaf Green', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_Green_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Leaf Leafless', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_LeaflessTeal_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Leaf Orange', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_Orange_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Leaf Red', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_Red_Cog.tif', area: 2, type: 'singleband' },
  { label: 'Area2 Leaf Yellow', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_Yellow_Cog.tif', area: 2, type: 'singleband' },
];

export function addRasterLayerPanel(map: OLMap, panelEl: HTMLElement): void {
  const cache = new globalThis.Map<string, WebGLTileLayer>();

  RASTER_CATALOG.forEach((entry) => {
    const wrapper = document.createElement('div');
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = false;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + entry.label));
    wrapper.appendChild(label);
    panelEl.appendChild(wrapper);

    cb.addEventListener('change', () => {
      if (cb.checked) {
        let layer = cache.get(entry.path);
        if (!layer) {
          if (entry.type === 'rgb') {
            layer = new WebGLTileLayer({
              source: new GeoTIFF({
                sources: [{ url: entry.path }],
              }),
            });
          } else {
            const isNDVI = entry.label.toLowerCase().includes('ndvi');
            const color = isNDVI
              ? ['interpolate', ['linear'], ['band', 1], 0, [255, 255, 255], 1, [255, 0, 0]]
              : ['interpolate', ['linear'], ['band', 1], 0, [0, 0, 0], 255, [255, 255, 255]];
            layer = new WebGLTileLayer({
              source: new GeoTIFF({
                sources: [{ url: entry.path }],
              }),
              style: { color },
            });
          }
          cache.set(entry.path, layer);
          map.addLayer(layer);
        } else {
          layer.setVisible(true);
        }
      } else {
        const layer = cache.get(entry.path);
        if (layer) layer.setVisible(false);
      }
    });
  });
}
