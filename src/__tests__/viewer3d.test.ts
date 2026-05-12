import { describe, it, expect, vi } from 'vitest';
import { initViewer3D } from '../viewer3d';

describe('initViewer3D', () => {
  it('shows fallback message when both Potree metadata files return 404', async () => {
    // Mock fetch: returns ok:false (404) so fileExists() returns false for both probes
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
    } as unknown as Response);

    const container = document.createElement('div');
    const viewer = initViewer3D(container);

    viewer.load();

    // Allow async tryLoad to settle (two awaited fetch calls + microtasks)
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(container.textContent).toContain('No point cloud data found');
  });

  it('does not create duplicate placeholders when load is called twice without metadata', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
    } as unknown as Response);

    const container = document.createElement('div');
    const viewer = initViewer3D(container);

    viewer.load();
    viewer.load();

    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(container.querySelectorAll('.potree-placeholder')).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('exposes analysis-layer controls before the async viewer is loaded', () => {
    const container = document.createElement('div');
    const viewer = initViewer3D(container);

    expect(() => viewer.setTreesVisible(false)).not.toThrow();
    expect(() => viewer.setFieldPointsVisible(false)).not.toThrow();
    expect(() => viewer.clearSelection()).not.toThrow();
    expect(() => viewer.focusSelection()).not.toThrow();
  });
});
