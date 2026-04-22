 # Student Developer Guide

 This repository is data first. It contains the Hutchinson Acres technical report and the geospatial outputs used for tree health analysis. There is no frontend or backend source code checked in yet, so the first job is to understand the science problem, the data, and the shape of a future dashboard.

 ## 1. What this project is

 The project supports a tree health dashboard for Hutchinson Acres, a sugar maple stand in Kings County, Nova Scotia. The scientists want to understand why some trees produce less sap and whether drone imagery, lidar, field points, or weather data can explain the pattern.

 The report in `projectContext/Hutchinson_Acres_Report_Final.pdf` describes:

 - Drone lidar, RGB, and multispectral surveys over two study areas
 - Ground GNSS points for flagged low-sap trees
 - Derived products such as DEM, DSM, hillshade, NHM, slope, aspect, contour lines, RGB orthomosaic, NDVI, and false colour imagery
 - Tree crown segmentation and leaf colour classification into green, yellow, orange, red, and leafless classes
 - A weather analysis over multiple years for sap flow and drought context

 The key result is important for the dashboard design. The report found only weak evidence in canopy colour and no strong correlations in the other remote sensing layers. That means the dashboard should help users explore patterns, not promise a single simple cause.

 ## 2. What the scientists are looking for

 The dashboard should help answer these questions:

 - Which trees look stressed from above
 - Whether stressed trees cluster in certain parts of the stand
 - Whether flagged low-sap trees differ from the rest of the canopy
 - Whether terrain matters, especially slope, aspect, contour, and stream proximity
 - Whether vegetation signals such as NDVI line up with low sap or leaf colour changes
 - Whether the problem appears to be above ground, below ground, or both
 - Whether the data can help with future decisions such as sap line routing, soil treatment, or more targeted field work

 The report suggests that canopy level remote sensing may not be enough by itself. That is a useful product requirement. The dashboard should surface uncertainty and make it easy to compare layers instead of overselling the signal.

 ## 3. Data inventory

 ### Main folders

 | Path | Type | What it contains | How to use it |
 | --- | --- | --- | --- |
 | `projectContext/` | Report | The Hutchinson Acres final PDF | Read first to understand the study and naming conventions |
 | `data/GeoJson/Area1/` | Vector | Contours, tree segmentation polygons, tree classification polygons | Use for overlays, popups, and counts |
 | `data/GeoJson/Area2/` | Vector | Contours, tree segmentation polygons, tree classification polygons, field points | Use for overlays, popups, and validation |
 | `data/COGs_Tiff/Mercator_Versions/Area1/` | Raster COGs | Hillshade, slope, NDVI, RGB orthomosaic, aspect, stream, leaf classification rasters | Use as map layers |
 | `data/COGs_Tiff/Mercator_Versions/Area2/` | Raster COGs | Hillshade, slope, NDVI, RGB orthomosaic, aspect, leaf classification rasters, stream | Use as map layers |
 | `data/Working_Tiff_Layers/` | Raster working files | Source TIFFs and sidecar files such as `.tfw`, `.aux.xml`, and VAT files | Keep as source or processing artifacts, not the default web layer |

 ### What the file names mean

 - `Area1` and `Area2` are the two study areas.
 - `LeafClassification` layers separate canopy trees by color class.
 - `Tree_Segmentation` layers contain individual tree crown polygons.
 - `Contour_Lines_1M` means 1 metre contour intervals.
 - `NDVI`, `Slope`, `Aspect`, `Hillshade`, and `DEM` are terrain or vegetation layers.
 - `Stream` layers are derived hydrology context layers.

 ### Data types in plain language

 #### GeoJSON point data

 Example: `data/GeoJson/Area2/Points_Area2_All.json`

 This is a FeatureCollection of points. Each point represents a field or analysis location. The file includes attributes such as `Point_ID`, projected coordinates like `X` and `Y`, elevation or survey fields such as `Ortho` and `Sep`, accuracy fields such as `SD_X`, `SD_Y`, and `SD_Z`, and class or zone fields like `ZONE_CODE`, `COUNT`, `AREA`, and `MAJORITY`.

 Important detail: GeoJSON geometry is stored as longitude and latitude, while some attributes also store projected UTM coordinates in metres. Do not assume every coordinate in the file uses the same system.

 #### GeoJSON polygon and line data

 Example: `data/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_All.json`

 These files store tree crowns as polygons or multipolygons. Contour data is stored as lines. The properties usually include geometry metrics like `Shape_Leng` and `Shape_Area`, plus class metadata such as `Class`, `Confidence`, `COUNT`, `AREA`, and majority class codes.

 #### COG GeoTIFF raster data

 The COG files are the web friendly versions of the raster products. They are better for an interactive dashboard than the working TIFF files because they support range requests and can be tiled efficiently.

 Typical raster layers include:

 - RGB orthophotos
 - NDVI
 - Hillshade
 - DEM or DSM products
 - Slope and aspect
 - Leaf classification rasters
 - Stream or drainage context layers

 #### Working TIFF layers

 These are useful when you need to inspect the original processing outputs or reproduce a product. For a dashboard, prefer the COG versions unless you are doing preprocessing.

 ## 4. What the important fields mean

 - `Class`: The mapped class, often `Tree` for segmentation outputs.
 - `Confidence`: The confidence score from the classification or segmentation step.
 - `Shape_Leng` and `Shape_Area`: Geometry metrics from GIS processing.
 - `Point_ID`: Unique field point identifier.
 - `X` and `Y`: Projected coordinates in metres.
 - `Ortho` and `Sep`: Survey elevation related values.
 - `SD_X`, `SD_Y`, `SD_Z`: Position uncertainty values.
 - `Contour`: Elevation value for contour lines.
 - `COUNT`, `AREA`, `MAJORITY`, `Majority_A`: Raster overlay or majority vote outputs from GIS processing.

 If you build the dashboard, keep the raw labels visible in popups, but also add human readable labels. The numeric class codes are not intuitive on their own.

 ## 5. The practical story in the report

 The study used two areas on the Hutchinson Acres property. Area 2 is especially useful because the staff had already flagged lower sap producing trees. The report compares those flagged trees against the remote sensing layers.

 The main interpretive points are:

 - Some trees show stress in leaf colour
 - Area 2 segmentation and field points are better aligned than Area 1 because the canopy is more intact
 - Canopy based layers did not explain the low-sap problem very well
 - Soil, roots, moisture, or other below-ground factors may be more important than what the drone can see from above

 This matters for the product. The dashboard should support a scientist looking for weak spatial signals, not just a visitor looking for pretty maps.

 ## 6. How students should think about implementation

 There is more than one valid technical path. The right choice depends on whether the goal is a quick internal tool, a research prototype, or a more complete client dashboard.

 ### Option A: Fastest useful MVP

 Build a 2D web map that loads the existing GeoJSON and raster layers.

 Suggested stack:

 - VS Code with Cline for agentic coding
 - TypeScript and Vite for the app
 - MapLibre GL JS or Leaflet for map rendering
 - A small raster tiling service such as TiTiler for the COGs, or browser COG reading if the layer count is small
 - Turf.js or simple geospatial helpers for summary calculations

 Good features for the first release:

 - Layer toggle panel
 - Legend and class descriptions
 - Popup on click for tree crowns, contour lines, or field points
 - Side panel with counts and percentages by class
 - Compare mode between Area 1 and Area 2
 - Filter for healthy versus stressed canopy classes

 This is the best first step if the goal is to give scientists a working dashboard quickly.

 ### Option B: Free satellite context with Google Earth Engine and Dynamic World

 Dynamic World is useful, but it is not 3D. It gives per pixel land cover probabilities from Sentinel-2, which can help with tree cover extent, disturbance, and seasonal change.

 Use it for:

 - Tree cover masking
 - Change detection over time
 - Broader landscape context outside the drone flight date
 - Comparing the study areas with surrounding land cover

 Good companion datasets:

 - Sentinel-2 surface reflectance for NDVI, red edge, and seasonal composites
 - Landsat 8 or 9 for longer time series
 - Google Earth Engine for cloud masking and rapid prototyping

 What it does not give you:

 - Tree height
 - True 3D canopy structure
 - Individual crown precision at the scale of the drone data

 If you frame this correctly, Dynamic World becomes a cheap way to expand the dashboard from a local drone view to a broader landscape view.

 ### Option C: 3D or canopy height workflow

 If the team wants 3D tree cover, use the drone lidar products as the main source of truth. Free satellite data can help with context, but it will not match drone lidar for crown level 3D detail.

 Practical options:

 - Use the lidar derived DEM, DSM, or NHM layers already described in the report
 - Use free global height or elevation sources for coarser context, such as GEDI footprints, ICESat-2 canopy metrics, SRTM, Copernicus DEM, or other open canopy height products if available
 - Use Dynamic World and Sentinel-2 to create a tree cover mask, then combine it with height proxies or lidar where available

 Good student takeaway:

 - Dynamic World helps answer where trees are
 - Lidar or height products help answer how tall they are
 - The two should not be confused

 ### Option D: Validation workflow

 The dashboard should include a validation story.

 Suggested checks:

 - Compare flagged low-sap points against the segmentation and leaf colour classes
 - Summarize counts around each point or within buffered zones
 - Compare Area 2 flagged trees against nearby control trees
 - Report uncertainty, not just class labels
 - Keep the original field notes visible where possible

 For scientists, trust comes from being able to trace a map feature back to a field point or an image tile.

 ### Option E: 3D viewer for advanced exploration

 If the project later needs a real 3D web view, use a point cloud or terrain viewer rather than trying to force a 2D satellite product into a 3D role.

 Possible tools:

 - CesiumJS for a 3D geospatial scene
 - Potree for point cloud viewing
 - deck.gl for analysis overlays and extrusions

 This is useful if the team wants to explore lidar surfaces, tree heights, or terrain in a more visual way.

 ## 7. Recommended build order

 1. Read the report and understand the study questions.
 2. Build a clean data catalog for the GeoJSON and COG files.
 3. Add a 2D map viewer with layer toggles.
 4. Add popups, legends, and class summaries.
 5. Add comparison views for Area 1 and Area 2.
 6. Add a validation panel for flagged low-sap trees.
 7. Add a free satellite context layer using Google Earth Engine and Dynamic World.
 8. Add optional 3D or canopy height exploration if the team needs it.

 ## 8. Setup in VS Code with Cline

 This project is meant for agentic coding in VS Code using Cline.

 ### Basic setup

 1. Open the repository root in VS Code.
 2. Install the Cline extension.
 3. Connect Cline to your model provider.
 4. Pick a low cost model for routine work.
 5. Ask Cline to inspect the `projectContext` and `data` folders before making changes.

 ### How to work with Cline well

 - Give one task at a time.
 - Ask for a short plan before code changes.
 - Ask Cline to read the relevant files first.
 - Keep edits small and reviewable.
 - Ask it to explain tradeoffs when you are choosing between map stacks or data pipelines.
 - Verify each feature with a browser or local preview before moving on.

 ### Suggested low cost models

 Pick the cheapest model that still follows instructions well. Good options usually include:

 - GPT-5.4 mini (xhigh)
 - Gemini Flash class models
 - Claude Haiku class models
 - Other fast, low cost coding models from your provider list

 For this project, GPT-5.4 mini (xhigh) is a good default. It is usually enough for documentation, file edits, layer wiring, and most planning tasks. Use a stronger model only when you need deeper reasoning or a larger refactor.

 ## 9. What to build first if you are a student

 If you are joining the project, do not start with machine learning.

 Start with this:

 - A map that shows Area 1 and Area 2
 - A toggle for segmentation, contours, NDVI, and leaf colour classes
 - Clickable tree polygons and field points
 - A small stats panel that counts healthy versus stressed classes
 - A note explaining that Dynamic World is for context, not true 3D canopy height

 After that, add the satellite context layer and then decide whether 3D is actually needed for the client question.

 ## 10. Short glossary

 - DEM: Bare earth elevation
 - DSM: Top of surface elevation including trees and buildings
 - NHM: Height above ground, useful for vegetation structure
 - NDVI: A vegetation index that highlights live green vegetation
 - COG: Cloud Optimized GeoTIFF, a raster format that works well on the web
 - GeoJSON: A common vector format for points, lines, and polygons
 - Dynamic World: Google Earth Engine land cover probabilities from Sentinel-2
 - RTK or GNSS: High accuracy field positioning

 ## 11. Bottom line

 This repository is a science and data workspace, not a finished app. The most useful student work is to turn the existing drone and field data into a clear dashboard, then add free satellite context and optional 3D support only where it helps answer the science question.