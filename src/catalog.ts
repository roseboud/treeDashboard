export type AreaId = 1 | 2;
export type StressClass = 'Green' | 'Yellow' | 'Orange' | 'Red' | 'NoLeaf';
export type VectorLayerKind = 'tree' | 'point' | 'contour';
export type RasterLayerKind = 'rgb' | 'singleband';

export interface VectorCatalogEntry {
  id: string;
  label: string;
  area: AreaId;
  kind: VectorLayerKind;
  path: string;
  defaultVisible: boolean;
  available: boolean;
  stressClass?: StressClass;
  aggregate?: boolean;
}

export interface RasterCatalogEntry {
  id: string;
  label: string;
  area: AreaId;
  kind: RasterLayerKind;
  path: string;
  defaultVisible: boolean;
  available: boolean;
}

export const VECTOR_CATALOG: VectorCatalogEntry[] = [
  { id: 'a1-tree-green', label: 'Area 1 - Healthy (Green)', area: 1, kind: 'tree', stressClass: 'Green', path: '/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Green.json', defaultVisible: true, available: true },
  { id: 'a1-tree-yellow', label: 'Area 1 - Mild Stress', area: 1, kind: 'tree', stressClass: 'Yellow', path: '/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Yellow.json', defaultVisible: true, available: true },
  { id: 'a1-tree-orange', label: 'Area 1 - Moderate Stress', area: 1, kind: 'tree', stressClass: 'Orange', path: '/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Orange.json', defaultVisible: true, available: true },
  { id: 'a1-tree-red', label: 'Area 1 - High Stress', area: 1, kind: 'tree', stressClass: 'Red', path: '/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Red.json', defaultVisible: true, available: true },
  { id: 'a1-tree-noleaf', label: 'Area 1 - Leafless', area: 1, kind: 'tree', stressClass: 'NoLeaf', path: '/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_Cyan_NoLeaf.json', defaultVisible: true, available: true },
  { id: 'a1-tree-classified-all', label: 'Area 1 - Classified Trees (All)', area: 1, kind: 'tree', path: '/GeoJson/Area1/Tree_Segmentation_with_Leaf_Classification_Area1_All.json', defaultVisible: false, available: true, aggregate: true },
  { id: 'a1-tree-segmentation-all', label: 'Area 1 - Tree Segmentation (All)', area: 1, kind: 'tree', path: '/GeoJson/Area1/Tree_Segmentation_Area1_All.json', defaultVisible: false, available: true, aggregate: true },
  { id: 'a1-contours', label: 'Area 1 - Contours', area: 1, kind: 'contour', path: '/GeoJson/Area1/Contour_Lines_1M_Area1.json', defaultVisible: true, available: true },

  { id: 'a2-tree-green', label: 'Area 2 - Healthy (Green)', area: 2, kind: 'tree', stressClass: 'Green', path: '/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Green.json', defaultVisible: true, available: true },
  { id: 'a2-tree-yellow', label: 'Area 2 - Mild Stress', area: 2, kind: 'tree', stressClass: 'Yellow', path: '/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Yellow.json', defaultVisible: true, available: true },
  { id: 'a2-tree-orange', label: 'Area 2 - Moderate Stress', area: 2, kind: 'tree', stressClass: 'Orange', path: '/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Orange.json', defaultVisible: true, available: true },
  { id: 'a2-tree-red', label: 'Area 2 - High Stress', area: 2, kind: 'tree', stressClass: 'Red', path: '/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Red.json', defaultVisible: true, available: true },
  { id: 'a2-tree-noleaf', label: 'Area 2 - Leafless', area: 2, kind: 'tree', stressClass: 'NoLeaf', path: '/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_Cyan_NoLeaf.json', defaultVisible: true, available: true },
  { id: 'a2-tree-classified-all', label: 'Area 2 - Classified Trees (All)', area: 2, kind: 'tree', path: '/GeoJson/Area2/Tree_Segmentation_with_Leaf_Classification_Area2_All.json', defaultVisible: false, available: true, aggregate: true },
  { id: 'a2-tree-segmentation-all', label: 'Area 2 - Tree Segmentation (All)', area: 2, kind: 'tree', path: '/GeoJson/Area2/Tree_Segmentation_Area2_All.json', defaultVisible: false, available: true, aggregate: true },
  { id: 'a2-points-all', label: 'Area 2 - Field Points (All)', area: 2, kind: 'point', path: '/GeoJson/Area2/Points_Area2_All.json', defaultVisible: true, available: true, aggregate: true },
  { id: 'a2-points-green', label: 'Area 2 - Field Points Healthy', area: 2, kind: 'point', stressClass: 'Green', path: '/GeoJson/Area2/Points_Area2_GreenLeaf.json', defaultVisible: false, available: true },
  { id: 'a2-points-yellow', label: 'Area 2 - Field Points Mild Stress', area: 2, kind: 'point', stressClass: 'Yellow', path: '/GeoJson/Area2/Points_Area2_YellowLeaf.json', defaultVisible: false, available: true },
  { id: 'a2-points-orange', label: 'Area 2 - Field Points Moderate Stress', area: 2, kind: 'point', stressClass: 'Orange', path: '/GeoJson/Area2/Points_Area2_OrangeLeaf.json', defaultVisible: false, available: true },
  { id: 'a2-points-red', label: 'Area 2 - Field Points High Stress', area: 2, kind: 'point', stressClass: 'Red', path: '/GeoJson/Area2/Points_Area2_RedLeaf.json', defaultVisible: false, available: true },
  { id: 'a2-points-noleaf', label: 'Area 2 - Field Points Leafless', area: 2, kind: 'point', stressClass: 'NoLeaf', path: '/GeoJson/Area2/Points_Area2_Cyan_NoLeaf.json', defaultVisible: false, available: true },
  { id: 'a2-contours', label: 'Area 2 - Contours', area: 2, kind: 'contour', path: '/GeoJson/Area2/Contour_Lines_1M_Area2.json', defaultVisible: true, available: true },
];

export const RASTER_CATALOG: RasterCatalogEntry[] = [
  { id: 'a1-ndvi', label: 'Area 1 NDVI', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutchinson_APT_Area1_NDVI_FORCED_Cog.tif', defaultVisible: false, available: false },
  { id: 'a1-hillshade', label: 'Area 1 Hillshade', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutch_Section1_Hillshade_ForContours_clipped_FORCED_Cog.tif', defaultVisible: true, available: true },
  { id: 'a1-slope', label: 'Area 1 Slope', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutch_Section1_Slope_clipped_FORCED_Cog.tif', defaultVisible: false, available: true },
  { id: 'a1-aspect', label: 'Area 1 Aspect', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/Hutch_Section1_Aspect_clipped_FORCED_Cog.tif', defaultVisible: false, available: true },
  { id: 'a1-rgb-part1', label: 'Area 1 RGB Part 1', area: 1, kind: 'rgb', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutchinson_Area1_L2_Photo_RGB_NoHoleFilling_Fill_RC_Ortho_Cog_part1.tif', defaultVisible: false, available: false },
  { id: 'a1-rgb-part2', label: 'Area 1 RGB Part 2', area: 1, kind: 'rgb', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutchinson_Area1_L2_Photo_RGB_NoHoleFilling_Fill_RC_Ortho_Cog_part2.tif', defaultVisible: false, available: false },
  { id: 'a1-dem-hillshade', label: 'Area 1 DEM Hillshade', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/20250919_Hutchinson_Section1_DEM_50cm_Class2-3_Hillshade_Clipped_FORCED_Cog.tif', defaultVisible: false, available: true },
  { id: 'a1-stream', label: 'Area 1 Stream', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/Stream_Area1_clipped_Cog.tif', defaultVisible: false, available: true },
  { id: 'a1-leaf-green', label: 'Area 1 Leaf Green', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_Green_Cog.tif', defaultVisible: false, available: true },
  { id: 'a1-leaf-noleaf', label: 'Area 1 Leaf Leafless', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_LeaflessTeal_Cog.tif', defaultVisible: false, available: true },
  { id: 'a1-leaf-orange', label: 'Area 1 Leaf Orange', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_Orange_Cog.tif', defaultVisible: false, available: true },
  { id: 'a1-leaf-red', label: 'Area 1 Leaf Red', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_Red_Cog.tif', defaultVisible: false, available: true },
  { id: 'a1-leaf-yellow', label: 'Area 1 Leaf Yellow', area: 1, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area1/Area1_LeafClassification_Yellow_Cog.tif', defaultVisible: false, available: true },

  { id: 'a2-ndvi', label: 'Area 2 NDVI', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/20250919_Hutchinson_APT_Area2_NDVI_FORCED_Cog.tif', defaultVisible: false, available: false },
  { id: 'a2-hillshade', label: 'Area 2 Hillshade', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/HillShade_Hutch_Area2_ForStream_clipped_FORCED_Cog.tif', defaultVisible: true, available: true },
  { id: 'a2-slope', label: 'Area 2 Slope', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/20250919_Hutch_Section2_Slope_clipped_FORCED_Cog.tif', defaultVisible: false, available: true },
  { id: 'a2-aspect', label: 'Area 2 Aspect', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/Aspect_Section2_clipped_FORCED_Cog.tif', defaultVisible: false, available: true },
  { id: 'a2-rgb', label: 'Area 2 RGB', area: 2, kind: 'rgb', path: '/COGs_Tiff/Mercator_Versions/Area2/20250919_Hutchinson_Area2_L2_RGB_Ortho_Cog.tif', defaultVisible: false, available: false },
  { id: 'a2-dem-hillshade', label: 'Area 2 DEM Hillshade', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/20250919_Hutchinson_Section2_DEM_50cm_Class2-3_Hillshade_Clipped_FORCED_Cog.tif', defaultVisible: false, available: true },
  { id: 'a2-stream', label: 'Area 2 Stream', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_Hutch_Stream_Cog.tif', defaultVisible: false, available: true },
  { id: 'a2-leaf-green', label: 'Area 2 Leaf Green', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_Green_Cog.tif', defaultVisible: false, available: true },
  { id: 'a2-leaf-noleaf', label: 'Area 2 Leaf Leafless', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_LeaflessTeal_Cog.tif', defaultVisible: false, available: true },
  { id: 'a2-leaf-orange', label: 'Area 2 Leaf Orange', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_Orange_Cog.tif', defaultVisible: false, available: true },
  { id: 'a2-leaf-red', label: 'Area 2 Leaf Red', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_Red_Cog.tif', defaultVisible: false, available: true },
  { id: 'a2-leaf-yellow', label: 'Area 2 Leaf Yellow', area: 2, kind: 'singleband', path: '/COGs_Tiff/Mercator_Versions/Area2/Area2_LeafClassification_Yellow_Cog.tif', defaultVisible: false, available: true },
];
