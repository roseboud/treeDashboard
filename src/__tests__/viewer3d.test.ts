import { describe, it, expect, vi } from 'vitest';
import { initViewer3D } from '../viewer3d';

describe('initViewer3D', () => {
  it('shows fallback message when both cloud.js and ept.json return 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const container = document.createElement('div');
    const viewer = initViewer3D(container);

    viewer.load();

    // Allow async tryLoad microtasks to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(container.textContent).toContain('Point cloud not found');
  });
});
