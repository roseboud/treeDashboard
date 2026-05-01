# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive web dashboard for visualizing tree health (leaf stress classification) across two survey areas (Hutchinson Acres sugar maple stand, Nova Scotia). Built with drone imagery, lidar, field sampling points, and weather data.

## Running the Dashboard

No build step — serve the repo root with any static HTTP server:

```powershell
python -m http.server 8000
# then open http://localhost:8000
```

Or use VS Code Live Server extension. The dashboard fetches GeoJSON files asynchronously from `data/GeoJson/`, so it must be served over HTTP (not opened as `file://`).

## Architecture

Everything lives in a single file: **`index.html`** — inline CSS, inline JS, no separate modules.

**Map library:** Leaflet 1.9.4 (loaded from CDN at `unpkg.com`). Basemap: CartoDB Voyager.

**Data layers loaded at runtime:**
- `data/GeoJson/Area1/` and `data/GeoJson/Area2/` — 22 GeoJSON files total covering:
  - Tree crown segmentation polygons (split by stress class: Green, Yellow, Orange, Red, NoLeaf)
  - Field sampling points
  - Elevation contour lines
- COG GeoTIFF rasters in `data/COGs_Tiff/Mercator_Versions/` exist but are **not yet loaded** by the dashboard (future work)

**Stress classification color scheme:**
| Class | Color |
|-------|-------|
| Green (healthy) | `#00C040` |
| Yellow (mild stress) | `#FFD700` |
| Orange (moderate stress) | `#FF8C00` |
| Red (high stress) | `#CC0000` |
| NoLeaf (leafless) | `#00CED1` (cyan) |

**Key JS patterns in `index.html`:**
- `loadGeoJSON(url, layerName)` — async fetch → Leaflet GeoJSON layer with style/popup callbacks
- Layer toggle panel driven by an object mapping display names to Leaflet layer references
- Live stats panel updated after each layer loads (counts trees, field points, contours)
- Popup builders handle three feature types: tree polygons, field points, contour lines

## Data Notes

Large raster files use **Git LFS** (see `.gitattributes` for tracked extensions: `.tif`, `.tiff`, `.zip`, `.geojson`). The RGB ortho GeoTIFFs (~3.78 GB each area) are split into two ~1.89 GB parts.

Authoritative project documentation and science context: **`STUDENT_DEVELOPER_GUIDE.md`** — read this before planning any feature additions. It describes all 22 GeoJSON files, all 13 COG raster layers per area, and five prioritized implementation options.
