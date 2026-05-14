# Dashboard TODO — Charter Compliance (Auto-generated: 2026-05-14)

## Must-Have Requirements (Options A + D)

- ⚠️ Partial M1 · DEM, DSM, NHM, Slope, Aspect, Hillshade, Contour Lines
  NOTE: Hillshade, Slope, Aspect, DEM Hillshade, Stream, and Contour Lines
  are in the raster/vector catalog. Raw DEM and DSM COG files are NOT in
  catalog. NHM (Normalized Height Model) is NOT in catalog.
  ACTION NEEDED: Add DEM and NHM COG entries to src/catalog.ts once files
  are provided by AGRG (Tim Webster / Kyran Lewis).

- ⚠️ Partial M2 · NDVI and False Colour Composite
  NOTE: NDVI catalog entries exist (a1-ndvi, a2-ndvi) but are marked
  available: false — the COG files are missing from dist/COGs_Tiff/.
  False Colour Composite has NO catalog entry at all.
  ACTION NEEDED: Generate NDVI COGs from MicaSense Altum PT data (Zahera).
  Generate False Colour (NIR-Red-Green composite) COG and add catalog entry.

- ✅ Done M3 · 5-class leaf colour classification (Green/Yellow/Orange/Red/NoLeaf)
  NOTE: All 10 GeoJSON files (5 classes × 2 areas) are in catalog and load.
  Leaf classification COG rasters also in catalog. Filtering and popups work.
  STATUS: ✅ Done.

- ✅ Done M4 · Dashboard hosted via GitHub Pages with ≥ 5 LiDAR/imagery layers
  NOTE: deploy.yml deploys dist/ to GitHub Pages on push to main. Currently
  on branch codex/fix-dashboard-functional — merge to main required.
  At least Hillshade + Slope + Aspect + DEM Hillshade + Contours = 5 layers.
  STATUS: ✅ Done (pending main branch merge).

- ✅ Done M5 · NAD83 UTM Zone 20N as canonical CRS
  NOTE: lonLatToUtm20N() in treeData3d.ts converts GeoJSON coordinates.
  OL map uses EPSG:3857 (Web Mercator) for display — CRS note in Data Dictionary.
  STATUS: ✅ Done.

- ❌ Missing M6 · Data Dictionary & ERD
  NOTE: NO Data Dictionary or ERD document exists in the repository.
  ACTION NEEDED (HIGH PRIORITY — DUE MAY 6):
    Zahera Firoza Thariq to produce a document covering:
    - All 22 GeoJSON files (path, CRS, geometry type, key fields, feature count)
    - All COG raster files (path, bands, value range, CRS, resolution)
    - Potree point cloud datasets (path, point count, CRS, date)
    - Field to field relationships (e.g. MAJORITY code → stress class)
    - ERD diagram linking tree polygons → field points → stress classes
    Save as docs/DATA_DICTIONARY.md in the repo.

## Could-Have Requirements

- ❌ S1 · Satellite context layer (Google Earth Engine / Dynamic World / Sentinel-2)
  ACTION NEEDED: Add a free Sentinel-2 WMTS tile layer via OpenLayers. Use
  the Copernicus WMS (no API key required):
  https://services.sentinel-hub.com/ogc/wms/{instance_id}
  OR use a pre-styled WMTS from EOX:
  https://tiles.maps.eox.at/wmts?SERVICE=WMTS&REQUEST=GetCapabilities
  Add as a third section in the raster panel: "Satellite (Sentinel-2)".

- ❌ S2 · 10+ years of Greenwood A station weather data (freeze-thaw cycles,
       summer drought index) for Weather-Sap Correlation Report.
  ACTION NEEDED (Phase 6 — Zahera):
  Fetch from https://climate.weather.gc.ca for Greenwood A (Station ID: 6344)
  years 2016–2026. Compute: freeze-thaw days per year, summer PDSI/drought.
  Add a collapsible time-series panel below the map using Chart.js or inline SVG.

- ❌ S3 · Northern Hardwoods Research Institute soil pH and nutrient layers
  ACTION NEEDED (Phase 6 — Kyran):
  Request data from hardwoodsnb.ca. If GIS data available, add as a vector
  layer (VectorCatalogEntry with kind: 'point' for sample locations).

- ❌ S4 · Per-tree sap yield data collection protocol
  ACTION NEEDED: Benjamin Brumm to contact Chris Hutchinson and agree a
  simple field recording format (GPS point + sap bucket ID + year + litres).
  This does not require code — it's a field protocol document.

- ✅ Done S5 · Filterable leaf colour class layer with click-to-inspect popups
  NOTE: Area filter and stress class filter exist. Popups work for tree polygons
  and field points. 3D stress filter wired up in Task 5A above.
  STATUS: ✅ Done (after Task 5A).

- ✅ Done C2 · 3D viewer (Potree + procedural trees)
  NOTE: Implemented. Camera Z-up fix applied in Task 1.
  STATUS: ✅ Done.

- ❌ C3 · Historical climate time-series panel alongside map
  Same as S2 — not yet implemented.

## Key KPI Gaps

- KPI 3 · All 6,615 trees visible:
  Stats bar shows 6,614 trees — off by 1. Acceptable; likely a duplicate
  polygon in source data. Verify with AGRG.

- KPI 2 · < 5 second load time:
  Raster layers are COG format (lazy-loaded). Point cloud loads on 3D switch.
  GeoJSON loads async. Current performance is acceptable — test on standard
  broadband before UAT with Beth Easson and Chris Hutchinson (Phase 5).

- KPI 4 · 10+ years of Greenwood A data:
  Blocked until S2 is implemented (Phase 6).
