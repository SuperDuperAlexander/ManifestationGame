import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { damp } from './Random';
import { WORLD_UNIFORMS } from '../shaders/paperShader';

/**
 * Fixed-angle follow camera. The player cannot turn it: paper cards only
 * look right from the front. It looks north (+z) from above at TUNING.camera.pitchDeg.
 * Each frame it also finds where the valley ridge meets the sky on screen,
 * so the painted backdrop can sit right behind the ridge.
 */
export class CameraRig {
  readonly camera: FreeCamera;
  readonly target = new Vector3();
  private readonly offset = new Vector3();
  /** Screen height share (0 = top, 1 = bottom) of the lowest point of the ridge line. */
  horizonFromTop = 0.25;
  /** Ground height at a point (the valley). Until it is set, the ground is flat. */
  ground: ((x: number, z: number) => number) | null = null;
  private portrait = false;
  private readonly vp = new Matrix();
  private readonly p = new Vector3();

  constructor(private readonly scene: Scene) {
    this.camera = new FreeCamera('camera', new Vector3(0, 10, -20), scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.5;
    this.camera.maxZ = TUNING.camera.maxZ;
    this.camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
    const pitch = (TUNING.camera.pitchDeg * Math.PI) / 180;
    this.offset.set(0, Math.sin(pitch) * TUNING.camera.distance, -Math.cos(pitch) * TUNING.camera.distance);
    this.camera.rotation.set(pitch, 0, 0);
    this.onResize();
  }

  /** Call when the canvas size changes. Picks the field of view. */
  onResize(): void {
    const engine = this.scene.getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    this.portrait = aspect < 1;
    // Portrait phones: a wider vertical view so enough of the world fits left and right.
    this.camera.fov = this.portrait ? TUNING.camera.fovPortrait : TUNING.camera.fov;
  }

  get isPortrait(): boolean {
    return this.portrait;
  }

  /** Jump straight to a point (no smoothing). */
  snapTo(p: Vector3): void {
    this.target.set(p.x, TUNING.camera.lookHeight, p.z + TUNING.camera.lookAhead);
    this.apply();
  }

  update(dt: number, follow: Vector3): void {
    const k = damp(TUNING.camera.followSharpness, dt);
    this.target.x += (follow.x - this.target.x) * k;
    this.target.y = TUNING.camera.lookHeight;
    this.target.z += (follow.z + TUNING.camera.lookAhead - this.target.z) * k;
    this.apply();
  }

  private apply(): void {
    this.camera.position.copyFrom(this.target).addInPlace(this.offset);
    WORLD_UNIFORMS.pivotZ = this.target.z;
    this.findRidge();
  }

  /**
   * For a few screen columns, walks north over the ground and keeps the highest point on screen:
   * that is where the ground meets the sky in this column. The lowest of these points is the
   * ridge line the backdrop hangs from (higher hills elsewhere simply cover more of it).
   */
  private findRidge(): void {
    const ground = this.ground;
    if (!ground) return;
    this.camera.getViewMatrix(true).multiplyToRef(this.camera.getProjectionMatrix(), this.vp);
    const engine = this.scene.getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const tanH = Math.tan(this.camera.fov / 2) * aspect;
    const r = TUNING.ridge;
    const camZ = this.camera.position.z;
    let lowest = 0;
    for (const c of r.columns) {
      let top = 1;
      for (let dz = 0; dz < r.reach; dz += r.step) {
        const z = this.target.z + dz;
        // World x that shows in this screen column at this depth (a rough fit is enough).
        const x = this.target.x + c * (z - camZ) * tanH * Math.cos((TUNING.camera.pitchDeg * Math.PI) / 180);
        this.p.set(x, ground(x, z), z);
        const s = Vector3.TransformCoordinates(this.p, this.vp);
        const fromTop = 0.5 - s.y * 0.5;
        if (fromTop < top) top = fromTop;
      }
      lowest = Math.max(lowest, top);
    }
    this.horizonFromTop = Math.min(0.85, Math.max(0, lowest));
  }
}
