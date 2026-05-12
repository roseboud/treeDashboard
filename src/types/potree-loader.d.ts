declare module 'potree-loader' {
  import type { Box3, Object3D, PerspectiveCamera, WebGLRenderer } from 'three';

  export class PointCloudOctree extends Object3D {
    material: {
      size: number;
      pointColorType?: number;
      dispose?: () => void;
    };
    pcoGeometry: {
      boundingBox: Box3;
      tightBoundingBox?: Box3;
      spacing?: number;
    };
    boundingBox: Box3;
    numVisiblePoints?: number;
    visibleNodes?: unknown[];
    disposed?: boolean;
    dispose(): void;
  }

  export class Potree {
    pointBudget: number;
    loadPointCloud(
      url: 'metadata.json' | 'cloud.js',
      getUrl: (relativeUrl: string) => string,
      xhrRequest?: typeof fetch
    ): Promise<PointCloudOctree>;
    updatePointClouds(
      pointClouds: PointCloudOctree[],
      camera: PerspectiveCamera,
      renderer: WebGLRenderer
    ): unknown;
  }
}