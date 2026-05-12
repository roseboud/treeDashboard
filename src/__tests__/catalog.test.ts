import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { RASTER_CATALOG, VECTOR_CATALOG } from '../catalog';

function publicPathExists(path: string): boolean {
  return existsSync(join(process.cwd(), 'data', path.replace(/^\//, '')));
}

describe('data catalogs', () => {
  it('lists every GeoJSON layer with publicDir-compatible paths', () => {
    expect(VECTOR_CATALOG).toHaveLength(22);
    VECTOR_CATALOG.forEach((entry) => {
      expect(entry.path.startsWith('/data/')).toBe(false);
      expect(entry.path.startsWith('/GeoJson/')).toBe(true);
      expect(publicPathExists(entry.path)).toBe(entry.available);
    });
  });

  it('marks missing COG assets unavailable and present COG assets available', () => {
    RASTER_CATALOG.forEach((entry) => {
      expect(entry.path.startsWith('/data/')).toBe(false);
      expect(entry.path.startsWith('/COGs_Tiff/')).toBe(true);
      expect(publicPathExists(entry.path)).toBe(entry.available);
    });
  });
});
