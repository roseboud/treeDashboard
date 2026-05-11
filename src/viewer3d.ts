export function initViewer3D(containerEl: HTMLElement): { load(): void; destroy(): void } {
  containerEl.style.display = 'none';

  let loaded = false;
  let gl: WebGLRenderingContext | null = null;

  /** Returns true only if the URL serves a non-HTML file that actually exists. */
  async function fileExists(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) return false;
      // Guard against Vite SPA fallback silently returning index.html (text/html)
      const ct = res.headers.get('content-type') ?? '';
      if (ct.startsWith('text/html')) return false;
      return true;
    } catch {
      return false;
    }
  }

  async function tryLoad() {
    const hasCloud = await fileExists('/potree/cloud.js');
    const hasEpt   = !hasCloud && await fileExists('/potree/ept.json');

    if (!hasCloud && !hasEpt) {
      containerEl.innerHTML = `
        <div class="potree-placeholder">
          <div class="potree-icon">☁</div>
          <p>No point cloud data found</p>
          <small>Place Potree2 output in <code>data/potree/</code></small>
        </div>`;
      console.warn('No Potree data found at /potree/ — showing placeholder');
      return;
    }

    console.log(hasCloud ? 'Potree2 cloud.js found' : 'EPT/COPC ept.json found');

    // ── Minimal WebGL placeholder (swap with real Potree2 viewer when ready) ──
    const canvas = document.createElement('canvas');
    // Set the backing buffer to the container's pixel dimensions (not just CSS %)
    canvas.style.width  = '100%';
    canvas.style.height = '100%';
    // Use a rAF so the layout has settled and clientWidth/Height are non-zero
    requestAnimationFrame(() => {
      canvas.width  = containerEl.clientWidth  || window.innerWidth;
      canvas.height = containerEl.clientHeight || (window.innerHeight - 52);
      gl = canvas.getContext('webgl');
      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.06, 0.07, 0.09, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    });

    containerEl.innerHTML = '';
    containerEl.appendChild(canvas);
  }

  return {
    load() {
      if (loaded) return;
      loaded = true;
      containerEl.style.display = 'block';
      void tryLoad();
    },
    destroy() {
      if (gl) {
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        gl = null;
      }
    },
  };
}
