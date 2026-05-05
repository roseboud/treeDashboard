"""
Hutchinson Acres - GeoJSON Data Cleaning Script
================================================
This script handles Steps 1, 2, and 3 of the data cleaning process:

  Step 1 - Rebuilds the _All files by merging the 5 colour files
  Step 2 - Removes the Majority_A column from Area 2 files to align schemas
  Step 3 - Reprojects all files to WGS84 (EPSG:4326) for the dashboard

Run from inside the repo folder:
  python clean_data.py
"""

import os
import geopandas as gpd

# ── Config ─────────────────────────────────────────────────────────────────
BASE      = os.path.dirname(os.path.abspath(__file__))
AREA1_DIR = os.path.join(BASE, "data", "GeoJson", "Area1")
AREA2_DIR = os.path.join(BASE, "data", "GeoJson", "Area2")
TARGET_CRS = "EPSG:4326"  # WGS84

FIELD_TO_REMOVE = "Majority_A"

# Colour files to merge into _All (Area 1)
AREA1_COLOUR_FILES = [
    "Tree_Segmentation_with_Leaf_Classification_Area1_Green.json",
    "Tree_Segmentation_with_Leaf_Classification_Area1_Yellow.json",
    "Tree_Segmentation_with_Leaf_Classification_Area1_Orange.json",
    "Tree_Segmentation_with_Leaf_Classification_Area1_Red.json",
    "Tree_Segmentation_with_Leaf_Classification_Area1_Cyan_NoLeaf.json",
]

# Colour files to merge into _All (Area 2)
AREA2_COLOUR_FILES = [
    "Tree_Segmentation_with_Leaf_Classification_Area2_Green.json",
    "Tree_Segmentation_with_Leaf_Classification_Area2_Yellow.json",
    "Tree_Segmentation_with_Leaf_Classification_Area2_Orange.json",
    "Tree_Segmentation_with_Leaf_Classification_Area2_Red.json",
    "Tree_Segmentation_with_Leaf_Classification_Area2_Cyan_NoLeaf.json",
]

# All files to reproject (everything in both folders)
ALL_FILES = {
    AREA1_DIR: [f for f in os.listdir(AREA1_DIR) if f.endswith(".json")],
    AREA2_DIR: [f for f in os.listdir(AREA2_DIR) if f.endswith(".json")],
}

# ── Helpers ─────────────────────────────────────────────────────────────────
def load(folder, filename):
    path = os.path.join(folder, filename)
    print(f"  Loading {filename}...")
    return gpd.read_file(path)

def save(gdf, folder, filename):
    path = os.path.join(folder, filename)
    gdf.to_file(path, driver="GeoJSON")
    print(f"  Saved  {filename} ({len(gdf)} features)")

def reproject(gdf, filename):
    if gdf.crs is None:
        print(f"  WARNING: {filename} has no CRS — assuming WGS84, skipping reproject")
        gdf = gdf.set_crs(TARGET_CRS)
    elif gdf.crs.to_epsg() != 4326:
        print(f"  Reprojecting {filename} from {gdf.crs.to_epsg()} to WGS84...")
        gdf = gdf.to_crs(TARGET_CRS)
    else:
        print(f"  {filename} is already WGS84 — no reproject needed")
    return gdf

def drop_field(gdf, field, filename):
    if field in gdf.columns:
        gdf = gdf.drop(columns=[field])
        print(f"  Removed column '{field}' from {filename}")
    return gdf

# ── Step 1 — Rebuild _All files ─────────────────────────────────────────────
print("\n=== STEP 1: Rebuilding _All files from colour files ===\n")

# Area 1
print("Area 1:")
a1_parts = [load(AREA1_DIR, f) for f in AREA1_COLOUR_FILES]
a1_all = gpd.pd.concat(a1_parts, ignore_index=True)
a1_all = gpd.GeoDataFrame(a1_all, geometry="geometry")
print(f"  Merged total: {len(a1_all)} features (expected 2,776)")
if len(a1_all) != 2776:
    print(f"  WARNING: count mismatch — got {len(a1_all)}, expected 2,776")

# Area 2
print("\nArea 2:")
a2_parts = [load(AREA2_DIR, f) for f in AREA2_COLOUR_FILES]
a2_all = gpd.pd.concat(a2_parts, ignore_index=True)
a2_all = gpd.GeoDataFrame(a2_all, geometry="geometry")
print(f"  Merged total: {len(a2_all)} features (expected 3,838)")
if len(a2_all) != 3838:
    print(f"  WARNING: count mismatch — got {len(a2_all)}, expected 3,838")

# ── Step 2 — Fix schema (remove Majority_A from Area 2 files) ───────────────
print("\n=== STEP 2: Removing Majority_A column from Area 2 files ===\n")

a2_all = drop_field(a2_all, FIELD_TO_REMOVE, "Area2_All (merged)")

# Also strip from individual Area 2 colour files
a2_parts_clean = []
for i, f in enumerate(AREA2_COLOUR_FILES):
    part = a2_parts[i]
    part = drop_field(part, FIELD_TO_REMOVE, f)
    a2_parts_clean.append((f, part))

# ── Step 3 — Reproject all files to WGS84 ───────────────────────────────────
print("\n=== STEP 3: Reprojecting all files to WGS84 ===\n")

# Reproject and save the rebuilt _All files
print("Saving Area 1 _All:")
a1_all = reproject(a1_all, "Area1_All")
save(a1_all, AREA1_DIR, "Tree_Segmentation_with_Leaf_Classification_Area1_All.json")

print("\nSaving Area 2 _All:")
a2_all = reproject(a2_all, "Area2_All")
save(a2_all, AREA2_DIR, "Tree_Segmentation_with_Leaf_Classification_Area2_All.json")

# Reproject and save the cleaned Area 2 colour files
print("\nSaving cleaned Area 2 colour files:")
for filename, gdf in a2_parts_clean:
    gdf = reproject(gdf, filename)
    save(gdf, AREA2_DIR, filename)

# Reproject all remaining files (Area 1 colour files + contour + points)
print("\nReprojecting remaining Area 1 files:")
for filename in os.listdir(AREA1_DIR):
    if not filename.endswith(".json"):
        continue
    if filename == "Tree_Segmentation_with_Leaf_Classification_Area1_All.json":
        continue  # already done
    gdf = load(AREA1_DIR, filename)
    gdf = reproject(gdf, filename)
    save(gdf, AREA1_DIR, filename)

print("\nReprojecting remaining Area 2 files:")
skip_a2 = {"Tree_Segmentation_with_Leaf_Classification_Area2_All.json"} | set(AREA2_COLOUR_FILES)
for filename in os.listdir(AREA2_DIR):
    if not filename.endswith(".json"):
        continue
    if filename in skip_a2:
        continue  # already done
    gdf = load(AREA2_DIR, filename)
    gdf = reproject(gdf, filename)
    save(gdf, AREA2_DIR, filename)

# ── Done ─────────────────────────────────────────────────────────────────────
print("\n=== ALL DONE ===")
print("Steps 1, 2, and 3 are complete.")
print("Now run Steps 4 and 5 in PowerShell as instructed.")
