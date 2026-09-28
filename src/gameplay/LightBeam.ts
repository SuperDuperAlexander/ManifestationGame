import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { smoothstep } from '../core/Random';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';

/**
 * A golden beam of light from the sky onto one spot, with a glow on the ground and
 * sparks drifting down. Plays once (TUNING.beam.duration) and cleans itself up.
 */
export class LightBeam {
  private readonly parts: { mesh: Mesh; mat: PaperMaterial; alpha: number }[] = [];
  private readonly sparks: ParticleSystem;
  private time = 0;
  done = false;

  constructor(scene: Scene, x: number, z: number) {
    const b = TUNING.beam;
    const add = (mesh: Mesh, texture: 'beam' | 'halo', alpha: number): void => {
      const mat = createPaperMaterial(`beamMat:${mesh.name}`, scene, { texture: procTexture(scene, texture), additive: true, haze: false });
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.alphaIndex = 30;
      this.parts.push({ mesh, mat, alpha });
    };
    // A wide soft column with a bright narrow core.
    for (const [i, w] of [b.width, b.width * 0.45].entries()) {
      const col = MeshBuilder.CreatePlane(`beam:${x}:${z}:${i}`, { width: w, height: b.height }, scene);
      col.position.set(x, b.height / 2 - 0.2, z);
      add(col, 'beam', i === 0 ? 0.75 : 1);
    }
    const pool = MeshBuilder.CreateGround(`beamPool:${x}:${z}`, { width: b.width * 2.6, height: b.width * 2.6 }, scene);
    pool.position.set(x, 0.06, z);
    add(pool, 'halo', 0.9);

    const ps = new ParticleSystem(`beamSparks:${x}:${z}`, 160, scene);
    ps.particleTexture = procTexture(scene, 'dot');
    ps.emitter = new Vector3(x, 9, z);
    ps.minEmitBox = new Vector3(-b.width * 0.4, -1, -0.4);
    ps.maxEmitBox = new Vector3(b.width * 0.4, 4, 0.4);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(1, 0.96, 0.82, 1);
    ps.color2 = new Color4(0.95, 0.8, 0.5, 1);
    ps.colorDead = new Color4(0.92, 0.77, 0.48, 0);
    ps.minSize = 0.08;
    ps.maxSize = 0.22;
    ps.minLifeTime = 1.6;
    ps.maxLifeTime = 2.8;
    ps.direction1 = new Vector3(-0.2, -3.2, -0.2);
    ps.direction2 = new Vector3(0.2, -4.2, 0.2);
    ps.emitRate = 60;
    ps.targetStopDuration = b.duration * 0.7;
    ps.disposeOnStop = true;
    ps.start();
    this.sparks = ps;
    this.update(0);
  }

  update(dt: number): void {
    if (this.done) return;
    this.time += dt;
    const d = TUNING.beam.duration;
    const t = this.time;
    // Opens quickly, holds, then fades softly.
    const a = smoothstep(0, 0.5, t) * (1 - smoothstep(d * 0.55, d, t));
    const width = 0.4 + 0.6 * smoothstep(0, 0.6, t);
    for (const p of this.parts) {
      setPaperColor(p.mat, new Color4(1, 1, 1, a * p.alpha));
      if (p.mesh.name.startsWith('beam:')) p.mesh.scaling.x = width;
    }
    if (t >= d) this.dispose();
  }

  dispose(): void {
    if (this.done) return;
    this.done = true;
    for (const p of this.parts) {
      p.mesh.dispose();
      p.mat.dispose(false, false);
    }
    this.sparks.stop();
  }
}
