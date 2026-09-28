import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES, color3 } from '../config/palette';
import { createToonMaterial, type ToonMaterial } from '../shaders/toonShader';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import { damp } from '../core/Random';

export interface PlayerVisualState {
  /** Ground speed, m/s. */
  speed: number;
  /** 0..1 share of the walk speed. */
  speedRatio: number;
  /** Facing angle around Y. 0 = north (+z). */
  heading: number;
  /** 0..1, how full the breath is. */
  breathLevel: number;
  /** 0..1 extra glow while inhaling. */
  glow: number;
  /** 0 = lying on the meadow, 1 = standing. */
  awake: number;
}

/**
 * The player's look. Kept behind this small interface so it can be swapped
 * for a GLB model later without touching the controller.
 */
export interface IPlayerVisual {
  readonly root: TransformNode;
  update(dt: number, state: PlayerVisualState): void;
  dispose(): void;
}

/**
 * A small figure in a red hooded cloak, built from primitives.
 * Animation is all code: walk bob, cloak sway, stepping feet, idle breathing, glow.
 */
export class PlayerVisual implements IPlayerVisual {
  readonly root: TransformNode;
  private readonly body: TransformNode;
  private readonly cloak: Mesh;
  private readonly hoodGroup: TransformNode;
  private readonly scarfTail: Mesh;
  private readonly feet: Mesh[] = [];
  private readonly shadow: Mesh;
  private readonly halo: Mesh;
  private readonly toonMats: ToonMaterial[] = [];
  private readonly haloMat: PaperMaterial;
  private phase = 0;
  private sway = 0;
  private time = 0;
  private lastHeading = 0;
  private turnRate = 0;

  constructor(scene: Scene) {
    this.root = new TransformNode('player', scene);
    this.body = new TransformNode('player.body', scene);
    this.body.parent = this.root;

    const cloakMat = this.toon('cloak', PALETTE.cloak, SHADES.cloakShadow);
    const umberMat = this.toon('umber', SHADES.umber, '#2E211A');
    const scarfMat = this.toon('scarf', SHADES.scarf, '#A9542F');
    const goldMat = this.toon('gold', PALETTE.gold, '#C39A55');

    // Cloak: a lathe, wide at the hem, narrow at the shoulders.
    const profile = [
      new Vector3(0.0, 0.02, 0),
      new Vector3(0.38, 0.03, 0),
      new Vector3(0.37, 0.1, 0),
      new Vector3(0.31, 0.32, 0),
      new Vector3(0.24, 0.55, 0),
      new Vector3(0.19, 0.7, 0),
      new Vector3(0.12, 0.78, 0),
      new Vector3(0.0, 0.8, 0),
    ];
    this.cloak = MeshBuilder.CreateLathe('player.cloak', { shape: profile, tessellation: 22, cap: 0 }, scene);
    this.cloak.material = cloakMat;
    this.cloak.parent = this.body;

    // Hood: slightly pointed, leaning back a little.
    this.hoodGroup = new TransformNode('player.hoodGroup', scene);
    this.hoodGroup.parent = this.body;
    this.hoodGroup.position.set(0, 0.86, 0);
    const hood = MeshBuilder.CreateSphere('player.hood', { diameter: 0.46, segments: 14 }, scene);
    hood.scaling.set(1, 1.02, 1.06);
    hood.material = cloakMat;
    hood.parent = this.hoodGroup;
    const tip = MeshBuilder.CreateCylinder(
      'player.hoodTip',
      { diameterTop: 0, diameterBottom: 0.24, height: 0.26, tessellation: 12 },
      scene,
    );
    tip.position.set(0, 0.2, -0.05);
    tip.rotation.x = -0.35;
    tip.material = cloakMat;
    tip.parent = this.hoodGroup;
    // Face: a soft dark opening in the hood, seen when walking toward the camera.
    const face = MeshBuilder.CreateSphere('player.face', { diameter: 0.3, segments: 10 }, scene);
    face.scaling.set(1, 1.05, 0.45);
    face.position.set(0, -0.02, 0.17);
    face.material = umberMat;
    face.parent = this.hoodGroup;

    // Scarf: a collar and a tail that trails behind and sways.
    const collar = MeshBuilder.CreateTorus('player.collar', { diameter: 0.34, thickness: 0.09, tessellation: 18 }, scene);
    collar.position.set(0, 0.74, 0);
    collar.scaling.y = 0.8;
    collar.material = scarfMat;
    collar.parent = this.body;
    this.scarfTail = MeshBuilder.CreateBox('player.scarfTail', { width: 0.12, height: 0.34, depth: 0.03 }, scene);
    this.scarfTail.setPivotPoint(new Vector3(0, 0.17, 0));
    this.scarfTail.position.set(0.1, 0.56, -0.2);
    this.scarfTail.material = scarfMat;
    this.scarfTail.parent = this.body;

    // Gold diamond on the back of the cloak, from the reference design.
    const emblem = MeshBuilder.CreatePolyhedron('player.emblem', { type: 1, size: 0.055 }, scene);
    emblem.scaling.set(0.7, 1.1, 0.25);
    emblem.position.set(0, 0.46, -0.265);
    emblem.material = goldMat;
    emblem.parent = this.body;

    // Feet.
    for (const side of [-1, 1]) {
      const foot = MeshBuilder.CreateSphere(`player.foot${side}`, { diameter: 0.2, segments: 8 }, scene);
      foot.scaling.set(0.62, 0.42, 0.9);
      foot.position.set(0.11 * side, 0.04, 0.05);
      foot.material = umberMat;
      foot.parent = this.root;
      this.feet.push(foot);
    }

    // Soft blob shadow on the ground.
    this.shadow = MeshBuilder.CreateGround('player.shadow', { width: 1.1, height: 0.9 }, scene);
    this.shadow.position.y = 0.03;
    this.shadow.material = createPaperMaterial('player.shadowMat', scene, {
      texture: procTexture(scene, 'shadow'),
      alphaBlend: true,
    });
    this.shadow.parent = this.root;

    // Warm halo around the figure. Visible while inhaling.
    this.haloMat = createPaperMaterial('player.haloMat', scene, {
      texture: procTexture(scene, 'halo'),
      additive: true,
      haze: false,
    });
    this.halo = MeshBuilder.CreatePlane('player.halo', { size: 3.2 }, scene);
    this.halo.position.set(0, 0.6, 0);
    this.halo.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    this.halo.material = this.haloMat;
    this.halo.parent = this.root;
    this.halo.isVisible = false;

    for (const m of this.root.getChildMeshes()) {
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }
  }

  private toon(name: string, hex: string, shadowHex: string): ToonMaterial {
    const mat = createToonMaterial(`player.${name}`, this.root.getScene(), color3(hex), color3(shadowHex));
    this.toonMats.push(mat);
    return mat;
  }

  update(dt: number, s: PlayerVisualState): void {
    this.time += dt;
    const moving = s.speedRatio;

    // Heading, with a little lean into turns.
    const dh = Math.atan2(Math.sin(s.heading - this.lastHeading), Math.cos(s.heading - this.lastHeading));
    this.lastHeading = s.heading;
    this.turnRate += ((dt > 0 ? dh / dt : 0) - this.turnRate) * damp(6, dt);
    this.root.rotation.y = s.heading;

    // Step cycle follows the distance walked.
    this.phase += s.speed * dt * 4.2;
    const step = Math.sin(this.phase);
    const bob = Math.abs(Math.cos(this.phase)) * 0.045 * moving;

    // Idle breathing: a slow, small swell. Inhaling fills the figure a little.
    const idle = Math.sin(this.time * 1.7) * 0.012 * (1 - moving);
    const breathSwell = s.breathLevel * 0.045;

    // Waking up: lying curled on the grass, then rising.
    const awake = s.awake;
    const lie = 1 - awake;
    this.body.position.y = bob - lie * 0.32;
    this.body.rotation.x = lie * 1.2;
    this.body.scaling.set(1 + breathSwell * 0.6, 1 + idle + breathSwell, 1 + breathSwell * 0.6);

    // Cloak sways back with speed and swings with the steps.
    this.sway += (moving * 0.16 - this.sway) * damp(5, dt);
    this.cloak.rotation.x = -this.sway * 0.6;
    this.cloak.rotation.z = step * 0.05 * moving - this.turnRate * 0.02;
    this.hoodGroup.rotation.x = -this.sway * 0.25 + Math.sin(this.time * 1.1) * 0.015;
    this.hoodGroup.rotation.z = -step * 0.04 * moving;

    // Scarf tail flutters more when walking.
    this.scarfTail.rotation.x = -0.35 - this.sway * 3 + Math.sin(this.time * 7 + 1) * 0.12 * (0.3 + moving);
    this.scarfTail.rotation.z = Math.sin(this.time * 3.3) * 0.12 + this.turnRate * 0.05;

    // Feet step forward and back, lifting a little.
    for (let i = 0; i < this.feet.length; i++) {
      const foot = this.feet[i]!;
      const p = i === 0 ? step : -step;
      foot.position.z = 0.05 + p * 0.15 * moving;
      foot.position.y = 0.04 + Math.max(0, p) * 0.06 * moving;
      foot.isVisible = awake > 0.5;
    }

    // Glow while inhaling.
    const glow = Math.max(s.glow, 0);
    for (const m of this.toonMats) m.glow = glow * 0.7;
    this.halo.isVisible = glow > 0.02;
    setPaperColor(this.haloMat, new Color4(1, 1, 1, Math.min(1, glow * 1.1)));
    const hs = 0.8 + glow * 0.6;
    this.halo.scaling.set(hs, hs, hs);
  }

  dispose(): void {
    this.root.dispose(false, false);
  }
}
