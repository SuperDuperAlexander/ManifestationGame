import { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TUNING } from '../config/tuning';
import type { AssetLoader, LoadedImage, TextureKindOptions } from '../core/AssetLoader';
import type { CameraRig } from '../core/CameraRig';
import type { Events } from '../core/Events';
import type { FogField } from '../gameplay/FogField';
import { xz } from '../types/chapter';
import { createPaperMaterial, type PaperMaterial } from '../shaders/paperShader';
import type { PlacedProp, ResolvedChapter, ResolvedZone } from './ChapterLoader';
import { createDisc, createGroundRect, createRibbon } from './Ground';
import { PaperCardSet } from './PaperCard';
import { procTexture } from './ProceduralTextures';
import { GROUND_OVERLAY_ALPHA_INDEX, type Terrain } from './Terrain';

type ZoneState = 'loading' | 'loaded';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Highest point inside, metres above 0. */
  top: number;
  /** Lowest point inside (default 0). */
  bottom?: number;
}

/** Something that can be hidden when off screen. */
interface Part {
  bounds: Bounds;
  setVisible: (v: boolean) => void;
  visible: boolean;
}

interface LoadedZone {
  id: string;
  state: ZoneState;
  root: TransformNode;
  container: AssetContainer;
  textures: { image: string; opts: TextureKindOptions }[];
  /** Prop images of this zone, by asset. The cards themselves are shared by all loaded zones. */
  images: Map<string, LoadedImage>;
  fogIds: string[];
  parts: Part[];
  /** Seconds since the zone was last wanted. Unloaded after a grace time. */
  unwanted: number;
  visible: boolean;
  cancelled: boolean;
}

/**
 * Keeps the current zone and its neighbours loaded, and nothing else.
 * Neighbours load in the background before the player gets there.
 * Far zones are disposed. Each zone lives in its own AssetContainer.
 * Props of all loaded zones share one card set per image (one draw call per image),
 * rebuilt when a zone comes or goes. Other parts of loaded zones are hidden when off screen.
 */
export class ZoneStreamer {
  private readonly loaded = new Map<string, LoadedZone>();
  private readonly sharedCards = new Map<string, PaperCardSet>();
  private sharedShadows: Mesh | null = null;
  current = '';
  private timer = 0;
  private readonly corner = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly chapter: ResolvedChapter,
    private readonly assets: AssetLoader,
    private readonly fogs: FogField,
    private readonly events: Events,
    private readonly rig: CameraRig,
    _terrain: Terrain,
  ) {}

  get loadedIds(): string[] {
    return [...this.loaded.values()].filter((z) => z.state === 'loaded').map((z) => z.id);
  }

  isLoaded(id: string): boolean {
    return this.loaded.get(id)?.state === 'loaded';
  }

  isVisible(id: string): boolean {
    const z = this.loaded.get(id);
    return !!z && z.state === 'loaded' && z.visible;
  }

  /** The zone the player is in: the one whose area is closest. */
  zoneAt(x: number, z: number): string {
    let best = this.current;
    let bestD = Infinity;
    for (const zone of this.chapter.zones.values()) {
      for (const a of zone.spec.areas) {
        const minX = zone.ox + a[0];
        const maxX = zone.ox + a[2];
        const minZ = zone.oz + a[1];
        const maxZ = zone.oz + a[3];
        const dx = Math.max(minX - x, 0, x - maxX);
        const dz = Math.max(minZ - z, 0, z - maxZ);
        const d = Math.hypot(dx, dz);
        if (d < bestD) {
          bestD = d;
          best = zone.spec.id;
        }
      }
    }
    return best;
  }

  /** Loads a zone and its neighbours and waits for all of them (first start). */
  async prime(zoneId: string): Promise<void> {
    this.current = zoneId;
    const wanted = this.wantedSet(zoneId);
    await Promise.all([...wanted].map((id) => this.load(id)));
    this.events.emit('zoneEntered', { id: zoneId });
  }

  private wantedSet(zoneId: string): Set<string> {
    const zone = this.chapter.zones.get(zoneId);
    const set = new Set<string>([zoneId]);
    for (const n of zone?.spec.neighbours ?? []) set.add(n);
    return set;
  }

  update(dt: number, px: number, pz: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = TUNING.streaming.checkInterval;
      const at = this.zoneAt(px, pz);
      if (at !== this.current) {
        this.current = at;
        this.events.emit('zoneEntered', { id: at });
      }
      const wanted = this.wantedSet(this.current);
      for (const id of wanted) if (!this.loaded.has(id)) void this.load(id);
      for (const z of this.loaded.values()) {
        if (wanted.has(z.id)) z.unwanted = 0;
        else {
          z.unwanted += TUNING.streaming.checkInterval;
          // A short grace time, so walking along a border does not load and unload over and over.
          if (z.unwanted > 3) this.unload(z.id);
        }
      }
    }
    this.cull();
  }

  /** Hides every part of the loaded zones that is off screen. Cheap: 8 corners per part. */
  private cull(): void {
    const test = (b: Bounds): boolean => this.boundsVisible(b);
    for (const z of this.loaded.values()) {
      if (z.state !== 'loaded') continue;
      for (const part of z.parts) {
        const v = test(part.bounds);
        if (v !== part.visible) {
          part.visible = v;
          part.setVisible(v);
        }
      }
    }
  }

  /** True if a box (from `bottom` to `top` metres high) can be seen this frame. */
  boundsVisible(b: Bounds): boolean {
    const cam = this.rig.camera;
    const vp = cam.getViewMatrix().multiply(cam.getProjectionMatrix());
    if (b.maxZ < cam.position.z - 2) return false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const x of [b.minX, b.maxX]) {
      for (const zz of [b.minZ, b.maxZ]) {
        for (const y of [b.bottom ?? 0, b.top]) {
          this.corner.set(x, y, zz);
          const p = Vector3.TransformCoordinates(this.corner, vp);
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      }
    }
    return !(maxX < -1.05 || minX > 1.05 || minY > 1.05 || maxY < -1.05);
  }

  /**
   * One card set per image for the props of all loaded zones, and one mesh for all their
   * blob shadows (only on the flat floor). Called when a zone has loaded or is unloaded.
   */
  private rebuildShared(): void {
    const byAsset = new Map<string, { img: LoadedImage; list: PlacedProp[] }>();
    const shadows: PlacedProp[] = [];
    for (const z of this.loaded.values()) {
      if (z.state !== 'loaded') continue;
      for (const p of this.chapter.zones.get(z.id)!.props) {
        const img = z.images.get(p.asset);
        if (!img) continue;
        let entry = byAsset.get(p.asset);
        if (!entry) byAsset.set(p.asset, (entry = { img, list: [] }));
        entry.list.push(p);
        if (p.shadow > 0 && (p.y ?? 0) < 0.05) shadows.push(p);
      }
    }
    for (const set of this.sharedCards.values()) set.dispose();
    this.sharedCards.clear();
    for (const [asset, { img, list }] of byAsset) {
      this.sharedCards.set(asset, new PaperCardSet(this.scene, asset, img, list, { shadows: false }));
    }

    this.sharedShadows?.material?.dispose();
    this.sharedShadows?.dispose();
    this.sharedShadows = null;
    if (!shadows.length) return;
    const sh = MeshBuilder.CreateGround('shadows', { width: 1, height: 1 }, this.scene);
    sh.material = createPaperMaterial('shadowMat', this.scene, { texture: procTexture(this.scene, 'shadow'), alphaBlend: true });
    sh.alphaIndex = GROUND_OVERLAY_ALPHA_INDEX + 2;
    sh.isPickable = false;
    const m = new Matrix();
    const buf = new Float32Array(shadows.length * 16);
    shadows.forEach((p, i) => {
      Matrix.ComposeToRef(new Vector3(p.shadow, 1, p.shadow * 0.55), Quaternion.Identity(), new Vector3(p.x, 0.035, p.z + 0.1), m);
      m.copyToArray(buf, i * 16);
    });
    sh.thinInstanceSetBuffer('matrix', buf, 16, true);
    sh.thinInstanceRefreshBoundingInfo(false);
    this.sharedShadows = sh;
  }

  private async load(id: string): Promise<void> {
    const zone = this.chapter.zones.get(id);
    if (!zone || this.loaded.has(id)) return;
    const root = new TransformNode(`zone:${id}`, this.scene);
    root.setEnabled(false);
    const entry: LoadedZone = {
      id,
      state: 'loading',
      root,
      container: new AssetContainer(this.scene),
      textures: [],
      images: new Map(),
      fogIds: [],
      parts: [],
      unwanted: 0,
      visible: false,
      cancelled: false,
    };
    this.loaded.set(id, entry);
    try {
      await this.build(zone, entry);
    } catch (err) {
      console.error(`[zones] failed to build ${id}`, err);
    }
    if (entry.cancelled) return;
    entry.state = 'loaded';
    entry.visible = true;
    root.setEnabled(true);
    this.rebuildShared();
    this.events.emit('zoneLoaded', { id });
  }

  private unload(id: string): void {
    const z = this.loaded.get(id);
    if (!z) return;
    this.loaded.delete(id);
    z.cancelled = true;
    for (const fid of z.fogIds) this.fogs.remove(fid);
    if (z.state === 'loaded') this.rebuildShared();
    z.container.dispose();
    z.root.dispose();
    for (const t of z.textures) this.assets.release(t.image, t.opts);
    this.events.emit('zoneUnloaded', { id });
  }

  private async texture(entry: LoadedZone, image: string, opts: TextureKindOptions = {}) {
    entry.textures.push({ image, opts });
    return this.assets.acquire(image, opts);
  }

  private adopt(entry: LoadedZone, mesh: Mesh, mat?: PaperMaterial, bounds?: Bounds): void {
    mesh.parent = entry.root;
    entry.container.meshes.push(mesh);
    if (mat) entry.container.materials.push(mat);
    let b = bounds;
    if (!b) {
      mesh.refreshBoundingInfo();
      const bb = mesh.getBoundingInfo().boundingBox;
      b = { minX: bb.minimumWorld.x, maxX: bb.maximumWorld.x, minZ: bb.minimumWorld.z, maxZ: bb.maximumWorld.z, top: 0.2 };
    }
    this.addPart(entry, b, (v) => mesh.setEnabled(v));
  }

  private addPart(entry: LoadedZone, bounds: Bounds, setVisible: (v: boolean) => void): void {
    entry.parts.push({ bounds, setVisible, visible: true });
  }

  private async build(zone: ResolvedZone, entry: LoadedZone): Promise<void> {
    const scene = this.scene;
    const id = zone.spec.id;

    // Ground overlays: plazas, paths, water, plain planes.
    for (const [i, g] of zone.ground.entries()) {
      if (g.type === 'plaza') {
        const img = await this.texture(entry, g.texture, { wrap: true, anisotropy: 4 });
        const mesh = createDisc(`${id}:plaza${i}`, scene, zone.ox + g.pos[0], zone.oz + g.pos[1], g.radius[0], g.radius[1], 0.015);
        const mat = createPaperMaterial(`${id}:plazaMat${i}`, scene, {
          texture: img.texture,
          worldTile: g.tile ?? TUNING.ground.stoneTile,
          alphaBlend: true,
          radialEdge: g.edge ?? 0.28,
        });
        mesh.material = mat;
        mesh.alphaIndex = GROUND_OVERLAY_ALPHA_INDEX;
        this.adopt(entry, mesh, mat);
      } else if (g.type === 'path' || g.type === 'water') {
        const img = await this.texture(entry, g.texture, { wrap: true, anisotropy: 4 });
        const points = g.points.map((p) => [zone.ox + p[0], zone.oz + p[1]] as [number, number]);
        const water = g.type === 'water';
        const { mesh, length } = createRibbon(`${id}:${g.type}${i}`, scene, points, g.width, water ? 0.03 : 0.02);
        const mat = createPaperMaterial(`${id}:${g.type}Mat${i}`, scene, {
          texture: img.texture,
          worldTile: g.tile ?? (water ? TUNING.ground.waterTile : TUNING.ground.pathTile),
          alphaBlend: true,
          water,
          ribbonEdge: { across: (water ? 0.9 : TUNING.ground.edgeSoftness) / g.width, ends: 1.2, length },
        });
        mesh.material = mat;
        mesh.alphaIndex = GROUND_OVERLAY_ALPHA_INDEX + (water ? 1 : 0);
        this.adopt(entry, mesh, mat);
      } else if (g.type === 'plane') {
        const img = await this.texture(entry, g.texture, { wrap: true, anisotropy: 4 });
        const [px, pz] = xz(g.pos);
        const mesh = createGroundRect(`${id}:plane${i}`, scene, zone.ox + px, zone.oz + pz, g.size[0], g.size[1], 0.01, 3);
        const mat = createPaperMaterial(`${id}:planeMat${i}`, scene, {
          texture: img.texture,
          worldTile: g.tile ?? TUNING.ground.grassTile,
        });
        mesh.material = mat;
        this.adopt(entry, mesh, mat);
      }
    }

    // Prop images. The cards are built for all loaded zones together (rebuildShared).
    const assets = [...new Set(zone.props.map((p) => p.asset))];
    const images = await Promise.all(assets.map(async (asset) => [asset, await this.texture(entry, asset)] as const));
    for (const [asset, img] of images) entry.images.set(asset, img);

    // Hidden paths: small marks of light that only show inside the player's light.
    const marks = zone.hiddenPaths.flat();
    if (marks.length) {
      const mesh = MeshBuilder.CreateGround(`${id}:hidden`, { width: 0.55, height: 0.55 }, scene);
      const mat = createPaperMaterial(`${id}:hiddenMat`, scene, {
        texture: procTexture(scene, 'dot'),
        additive: true,
        reveal: true,
        color: new Color4(1, 0.95, 0.8, 0.95),
      });
      mesh.material = mat;
      mesh.alphaIndex = GROUND_OVERLAY_ALPHA_INDEX + 3;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      const m = new Matrix();
      const buf = new Float32Array(marks.length * 16);
      marks.forEach(([x, z], i) => {
        const s = 0.8 + ((i * 37) % 10) / 20;
        Matrix.ComposeToRef(new Vector3(s, 1, s), Quaternion.Identity(), new Vector3(x, 0.06, z), m);
        m.copyToArray(buf, i * 16);
      });
      mesh.thinInstanceSetBuffer('matrix', buf, 16, true);
      this.adopt(entry, mesh, mat, {
        minX: Math.min(...marks.map((m) => m[0])) - 1,
        maxX: Math.max(...marks.map((m) => m[0])) + 1,
        minZ: Math.min(...marks.map((m) => m[1])) - 1,
        maxZ: Math.max(...marks.map((m) => m[1])) + 1,
        top: 0.2,
      });
    }

    // Fog blockades and fog walls. Released fogs stay gone.
    for (const b of zone.blockades) {
      if (this.fogs.isReleased(b.id)) continue;
      const fog = this.fogs.add({ id: b.id, x: b.x, z: b.z, text: b.text, release: b.release, points: b.points });
      if (fog) {
        entry.fogIds.push(b.id);
        this.addPart(entry, { minX: b.x - 4, maxX: b.x + 4, minZ: b.z - 2.5, maxZ: b.z + 2.5, top: 4 }, (v) => fog.setVisible(v));
      }
    }
    for (const f of zone.fogWalls) {
      if (this.fogs.isReleased(f.id)) continue;
      const fog = this.fogs.add({
        id: f.id,
        x: f.x,
        z: f.z,
        text: '',
        release: '',
        points: 0,
        size: f.size,
        stretch: f.stretch,
        breathable: false,
        solid: false,
      });
      if (fog) {
        entry.fogIds.push(f.id);
        const r = 4 * f.size * f.stretch;
        this.addPart(entry, { minX: f.x - r, maxX: f.x + r, minZ: f.z - r / 2, maxZ: f.z + r / 2, top: 4 * f.size }, (v) =>
          fog.setVisible(v),
        );
      }
    }
  }
}

