import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TUNING } from '../config/tuning';
import { PALETTE, color3 } from '../config/palette';
import type { AssetLoader } from '../core/AssetLoader';
import type { CameraRig } from '../core/CameraRig';
import type { BackdropLayer } from '../types/chapter';
import { createPaperMaterial, setPaperLayerHaze, type PaperMaterial } from '../shaders/paperShader';

interface Layer {
  spec: BackdropLayer;
  mesh: Mesh;
  mat: PaperMaterial;
  aspect: number;
  /** Where the painted content starts and ends, as a share of the image height (0 = top). */
  contentTop: number;
  baseX: number;
  maxShift: number;
  /** Height of the layer centre above the ridge line, in backdrop units. */
  aboveRidge: number;
}

/**
 * The painted distance: sky, mountains, the landmark and near hills.
 * All layers hang in front of the camera behind the world, in a fixed order
 * (alphaIndex 0..4, not depth sorting). They sit on the valley ridge, which covers their lower edges.
 * Far layers shift less than near layers when the camera moves: parallax.
 */
export class Backdrop {
  private readonly root: TransformNode;
  private readonly layers: Layer[] = [];
  /** World x the layers are centred on (middle of the region). */
  centreX = 0;
  /** Ridge height on screen the layers were laid out for; they follow from there. */
  private readonly refFromTop = 0.25;

  constructor(
    private readonly scene: Scene,
    private readonly rig: CameraRig,
    private readonly assets: AssetLoader,
  ) {
    this.root = new TransformNode('backdrop', scene);
    this.root.parent = rig.camera;
  }

  async build(specs: BackdropLayer[]): Promise<void> {
    const haze = Color3.Lerp(color3(PALETTE.ivory), color3(PALETTE.powder), 0.35);
    const loaded = await Promise.all(
      specs.map(async (spec) => ({
        spec,
        img: await this.assets.acquire(spec.image),
        content: await measureContent(this.assets.url(spec.image)),
      })),
    );
    loaded.forEach(({ spec, img, content }, i) => {
      const mat = createPaperMaterial(`backdropMat:${spec.id}`, this.scene, {
        texture: img.texture,
        alphaBlend: true,
        haze: false,
        layerHaze: true,
        depthWrite: false,
      });
      setPaperLayerHaze(mat, spec.haze, haze.r, haze.g, haze.b);
      const mesh = MeshBuilder.CreatePlane(`backdrop:${spec.id}`, { size: 1 }, this.scene);
      mesh.material = mat;
      mesh.parent = this.root;
      mesh.alphaIndex = i;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      this.layers.push({
        spec,
        mesh,
        mat,
        aspect: img.width / img.height,
        contentTop: img.placeholder ? 0 : content.top,
        baseX: 0,
        maxShift: 0,
        aboveRidge: 0,
      });
    });
    this.layout();
  }

  /** Sizes the layers for the current screen shape. Call after a resize. */
  layout(): void {
    const cam = this.rig.camera;
    const engine = this.scene.getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const d = TUNING.backdrop.distance;
    const halfH = d * Math.tan(cam.fov / 2);
    const halfW = halfH * aspect;
    const screenH = halfH * 2;
    const horizonY = halfH * (1 - 2 * this.refFromTop);
    const overscan = TUNING.backdrop.overscan;

    for (const l of this.layers) {
      const fit = l.spec.fit ?? (l.spec.id === 'sky' ? 'cover' : 'band');
      let w: number;
      let h: number;
      let y: number;
      let x = 0;
      if (fit === 'cover') {
        // The sky: full width and full height. Its top part (from `crop`) starts at the top of the screen.
        const crop = l.spec.crop ?? 0.12;
        h = Math.max((halfW * 2 * 1.04) / l.aspect, screenH / (1 - crop));
        w = h * l.aspect;
        y = halfH + crop * h - h / 2;
        l.maxShift = 0;
      } else {
        const rise = (l.spec.rise ?? 0.1) * screenH;
        if (fit === 'object') {
          w = (l.spec.width ?? 0.3) * halfW * 2;
          x = (l.spec.x ?? 0) * halfW * 2;
          l.maxShift = halfW * 0.6;
        } else {
          w = halfW * 2 * (1 + overscan);
          l.maxShift = halfW * overscan * 0.5;
        }
        h = w / l.aspect;
        const top = horizonY + rise + l.contentTop * h;
        y = top - h / 2;
      }
      l.baseX = x;
      l.aboveRidge = y - horizonY;
      l.mesh.scaling.set(w, h, 1);
      l.mesh.position.set(x, y, d + (this.layers.length - this.layers.indexOf(l)) * 0.5);
    }
    this.update();
  }

  /** Follows the camera sideways (parallax) and the valley ridge up and down. */
  update(): void {
    const camX = this.rig.target.x;
    const halfH = TUNING.backdrop.distance * Math.tan(this.rig.camera.fov / 2);
    const halfW = halfH * (this.scene.getEngine().getRenderWidth() / Math.max(1, this.scene.getEngine().getRenderHeight()));
    const refY = halfH * (1 - 2 * this.refFromTop);
    const ridgeY = halfH * (1 - 2 * this.rig.horizonFromTop);
    for (const l of this.layers) {
      if (l.maxShift <= 0) continue;
      const shift = -(camX - this.centreX) * (1 - l.spec.parallax) * TUNING.backdrop.shiftPerMetre * halfW * 2;
      l.mesh.position.x = l.baseX + Math.max(-l.maxShift, Math.min(l.maxShift, shift));
      const follow = l.spec.follow ?? 1;
      l.mesh.position.y = refY + (ridgeY - refY) * follow + l.aboveRidge;
    }
  }
}

/** Finds the painted part of an image (rows with visible pixels), as shares of its height. */
async function measureContent(url: string): Promise<{ top: number; bottom: number }> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = 96;
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { top: 0, bottom: 1 };
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let top = h;
    let bottom = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3]! > 40) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          break;
        }
      }
    }
    return top >= h ? { top: 0, bottom: 1 } : { top: top / h, bottom: (bottom + 1) / h };
  } catch {
    return { top: 0, bottom: 1 };
  }
}
