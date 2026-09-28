import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TUNING } from '../config/tuning';
import type { CameraRig } from '../core/CameraRig';
import { createPaperMaterial } from '../shaders/paperShader';
import { procTexture } from './ProceduralTextures';

interface Bird {
  /** Place in the flock (screen widths / heights, relative to the leader). */
  dx: number;
  dy: number;
  size: number;
  phase: number;
  /** Own flap speed, a little different for each bird. */
  flap: number;
}

/**
 * Small drawn birds in the sky, like far-away brush strokes. Now and then a flock crosses
 * the screen in a loose V, flapping and gliding. They hang in front of the camera like the
 * backdrop, in front of the painted mountains, and always fly above the valley ridge.
 * One mesh, thin instances: one draw call.
 */
export class SkyBirds {
  private readonly mesh: Mesh;
  private readonly matrices: Float32Array;
  private readonly max: number;
  private birds: Bird[] = [];
  private wait: number;
  /** 0..1 across the screen while a flock is flying. */
  private progress = 0;
  private dir = 1;
  /** Height of the flock, as a share of the space between the screen top and the ridge. */
  private height = 0.4;
  private time = 0;
  private readonly m = new Matrix();
  private readonly q = Quaternion.Identity();
  private readonly scale = new Vector3();
  private readonly pos = new Vector3();

  constructor(
    scene: Scene,
    private readonly rig: CameraRig,
  ) {
    const b = TUNING.birds;
    this.max = b.countMax;
    this.mesh = MeshBuilder.CreatePlane('sky.birds', { width: 1, height: 0.5 }, scene);
    const c = Color4.FromHexString(b.color + 'ff');
    c.a = b.alpha;
    this.mesh.material = createPaperMaterial('sky.birdsMat', scene, {
      texture: procTexture(scene, 'bird'),
      alphaBlend: true,
      haze: false,
      depthWrite: false,
      color: c,
    });
    this.mesh.parent = rig.camera;
    // After all backdrop layers (alphaIndex 0..4): in front of the painted mountains.
    this.mesh.alphaIndex = 4.5;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.matrices = new Float32Array(this.max * 16);
    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.mesh.thinInstanceCount = 0;
    this.wait = b.pauseMin * 0.5;
  }

  private startFlock(): void {
    const b = TUNING.birds;
    const n = b.countMin + Math.floor(Math.random() * (b.countMax - b.countMin + 1));
    this.birds = [];
    for (let i = 0; i < n; i++) {
      // A loose V: the leader in front, the others behind on both sides.
      const rank = Math.ceil(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      this.birds.push({
        dx: -rank * 0.035 + (Math.random() - 0.5) * 0.012,
        dy: rank * 0.03 * side + (Math.random() - 0.5) * 0.015,
        size: 0.75 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        flap: b.flap * (0.85 + Math.random() * 0.3),
      });
    }
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.height = 0.2 + Math.random() * 0.5;
    this.progress = 0;
  }

  update(dt: number): void {
    const b = TUNING.birds;
    this.time += dt;
    if (!this.birds.length) {
      this.wait -= dt;
      if (this.wait <= 0) this.startFlock();
      this.mesh.thinInstanceCount = 0;
      return;
    }
    this.progress += dt / b.crossTime;
    if (this.progress > 1) {
      this.birds = [];
      this.wait = b.pauseMin + Math.random() * (b.pauseMax - b.pauseMin);
      this.mesh.thinInstanceCount = 0;
      return;
    }

    // Screen size at the birds' distance (in front of the camera, like the backdrop).
    const cam = this.rig.camera;
    const engine = cam.getScene().getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const d = TUNING.backdrop.distance - 2;
    const halfH = d * Math.tan(cam.fov / 2);
    const halfW = halfH * aspect;
    // Between the top of the screen and a little above the ridge.
    const ridge = Math.max(0.07, this.rig.horizonFromTop - 0.03);
    const fromTop = 0.03 + (ridge - 0.03) * this.height;
    const baseY = halfH * (1 - 2 * fromTop);
    const baseX = (-1.15 + 2.3 * this.progress) * halfW * this.dir;
    const width = halfW * 2 * b.size;

    this.birds.forEach((bird, i) => {
      // Flap for a while, then glide with the wings up a little.
      const beat = Math.sin(this.time * bird.flap * Math.PI * 2 + bird.phase);
      const gliding = Math.sin(this.time * 0.35 + bird.phase) > 0.55;
      const wings = gliding ? 0.55 : beat;
      const w = width * bird.size;
      this.scale.set(w * this.dir, w * (0.25 + 0.75 * wings), 1);
      const bob = Math.sin(this.time * 0.8 + bird.phase) * halfH * 0.006;
      this.pos.set(baseX + bird.dx * halfW * 2 * this.dir, baseY + bird.dy * halfH * 2 + bob, d);
      Matrix.ComposeToRef(this.scale, this.q, this.pos, this.m);
      this.m.copyToArray(this.matrices, i * 16);
    });
    this.mesh.thinInstanceCount = this.birds.length;
    this.mesh.thinInstanceBufferUpdated('matrix');
  }
}
