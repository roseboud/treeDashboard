export function initViewer3D(containerEl: HTMLElement): { load(): void; destroy(): void } {
  containerEl.style.display = 'none';

  let loaded = false;
  let gl: WebGLRenderingContext | null = null;

  async function tryLoad() {
    try {
      const r1 = await fetch('/data/potree/cloud.js', { method: 'HEAD' });
      if (!r1.ok) throw new Error('cloud.js not found');
      // Potree2 format path (placeholder)
      console.log('Potree2 cloud.js found');
    } catch {
      try {
        const r2 = await fetch('/data/potree/ept.json', { method: 'HEAD' });
        if (!r2.ok) throw new Error('ept.json not found');
        console.log('EPT/COPC ept.json found');
      } catch {
        const msg = document.createElement('p');
        msg.textContent = 'Point cloud not found — place Potree2 output in data/potree/';
        containerEl.innerHTML = '';
        containerEl.appendChild(msg);
        console.warn('No Potree data found at /data/potree/');
        return;
      }
    }

    // Minimal WebGL placeholder for 3D container
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    containerEl.innerHTML = '';
    containerEl.appendChild(canvas);
    gl = canvas.getContext('webgl');
    if (gl) {
      gl.clearColor(0.1, 0.1, 0.1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
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
