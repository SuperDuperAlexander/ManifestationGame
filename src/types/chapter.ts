/**
 * The chapter file format (public/data/chapters/<id>.json).
 * Positions inside a zone are relative to the zone's `origin` and written [x, y, z] or [x, z].
 * Positions in `terrain`, `bridge.from/to` etc. are in world metres unless noted.
 * Image paths have no file extension; the loader adds ".webp".
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface BackdropLayer {
  id: string;
  image: string;
  /** 1 = follows the camera fully (never moves on screen), lower = moves more. */
  parallax: number;
  /** 0..1 blend toward the haze colour and lower contrast. */
  haze: number;
  /** "cover" fills the sky. "band" spans the width (mountains). "object" is one thing (landmark). */
  fit?: 'cover' | 'band' | 'object';
  /** How far the top of the painted content rises above the horizon, in screen heights. */
  rise?: number;
  /** For "object": width as a share of the screen width, and horizontal position (-0.5..0.5). */
  width?: number;
  x?: number;
  /** For "cover": share of the image hidden above the top of the screen. */
  crop?: number;
  /**
   * How much the layer moves up and down with the valley ridge on screen (0..1, default 1).
   * Far layers follow a little less, so more of them shows as the player walks toward the ridge.
   */
  follow?: number;
}

export interface AssetMeta {
  /** Default card height in metres. */
  height: number;
  /** Round collider radius at the default height (0 = walk through). */
  collider?: number;
  /** Several colliders instead of one: [dx, dz, radius] at the default height (arches, gates). */
  colliders?: [number, number, number][];
  /** Blob shadow width in metres at the default height (0 = none). */
  shadow?: number;
  /** Only assets that look right mirrored may be mirrored (grass, flowers). */
  mirror?: boolean;
}

export interface PropSpec {
  asset: string;
  /** One prop at this spot, or the centre of a scatter. */
  pos?: Vec3 | Vec2;
  /** Card height in metres (default: the asset's height). */
  scale?: number;
  /** Scatter N copies within `radius` around `pos`. */
  scatter?: number;
  radius?: number;
  /** A row of `count` copies from line[0] to line[1]. */
  line?: [Vec2, Vec2];
  count?: number;
  /** Position jitter for rows and scatters, metres. */
  jitter?: number;
  mirror?: boolean;
  /** Fixed turn in degrees (otherwise a small random turn). */
  rotY?: number;
  /** false = no collider even if the asset has one. */
  collide?: boolean;
}

export type GroundSpec =
  | { type: 'plane'; texture: string; size: Vec2; pos: Vec3 | Vec2; tile?: number }
  | { type: 'plaza'; texture: string; pos: Vec2; radius: Vec2; tile?: number; edge?: number }
  | { type: 'path'; texture: string; points: Vec2[]; width: number; tile?: number }
  | { type: 'water'; texture: string; points: Vec2[]; width: number; tile?: number; blocks?: boolean };

export interface BlockadeSpec {
  id: string;
  pos: Vec3 | Vec2;
  text: string;
  release: string;
  points: number;
  /** Cloud size (1 = normal) and width / height ratio. Big enough to close a path. */
  size?: number;
  stretch?: number;
  /** Fairy line (en.json key) when the player comes near. Default "hint". */
  hint?: string;
}

export interface HintSpec {
  id: string;
  pos: Vec3 | Vec2;
  /** Key of the fairy line in en.json. */
  line?: string;
  /** Literal text (only for quick tests; real lines belong in en.json). */
  text?: string;
  radius?: number;
}

export interface HiddenPathSpec {
  points: Vec2[];
  /** Metres between two light marks. */
  spacing?: number;
}

export interface FogWallSpec {
  id: string;
  pos: Vec3 | Vec2;
  size?: number;
  stretch?: number;
}

export interface ZoneEventSpec {
  type: 'fairyIntro' | 'say';
  trigger: 'onEnter';
  once?: boolean;
  line?: string;
}

export interface ZoneSpec {
  id: string;
  /** World position of the zone's (0, 0). */
  origin: Vec2;
  neighbours: string[];
  /**
   * The zone's region, local: [minX, minZ, maxX, maxZ]. Tells which zone the player is in.
   * Where the player may walk comes from `terrain.valley.floors`, not from here.
   */
  areas: [number, number, number, number][];
  ground: GroundSpec[];
  props: PropSpec[];
  blockades: BlockadeSpec[];
  hints: HintSpec[];
  hiddenPaths: HiddenPathSpec[];
  fogWalls: FogWallSpec[];
  /** Round places where walking is allowed even inside a blocker (fords). Local [x, z, r]. */
  passages: [number, number, number][];
  events: ZoneEventSpec[];
}

/** A closed valley: a flat walkable floor with hills around it (see src/world/Valley.ts). */
export interface ValleySpec {
  /** Ground texture of floor and hills. */
  texture: string;
  tile?: number;
  /** Walkable, flat ground: one or more outlines, world [x, z] points. */
  floors: Vec2[][];
  /** Middle of the valley. The hill height depends on the direction from here. */
  centre: Vec2;
  /**
   * Hills around the floor: they reach full height `width` metres from the floor edge.
   * `side` = east and west, `south` = near the camera, `north` = the low ridge in front of the backdrop.
   */
  rim: { width: number; side: number; south: number; north: number };
  /**
   * Extra hill ridges inside the valley (world lines), e.g. between two parts of the floor.
   * `height` metres at the line, falling off over `width` metres.
   */
  ridges?: { points: Vec2[]; height: number; width: number }[];
  /** How far the hills reach beyond the floor, metres (default 28). */
  margin?: number;
  /** Grid size of the ground mesh, metres (default 1). Chasm edges should sit on this grid. */
  cell?: number;
}

export interface TerrainSpec {
  valley: ValleySpec;
  /** Painted paths on the floor, world. Only a look: the whole floor is walkable. */
  paths: { texture: string; points: Vec2[]; width: number; tile?: number }[];
  /** Rivers between zones, world. They block walking. */
  water: { texture: string; points: Vec2[]; width: number; tile?: number }[];
  /** Holes in the ground with cliff walls and mist, world. */
  chasms: { rect: [number, number, number, number]; depth: number; waterfalls?: { x: number; width: number }[] }[];
  /** Fords over rivers: world [x, z, r]. */
  passages: [number, number, number][];
}

export interface BridgeSpec {
  zone: string;
  planksRequired: number;
  planksTotal: number;
  /** World start and end of the bridge (across the chasm). */
  from: Vec2;
  to: Vec2;
  width?: number;
  /** Planks each released blockade adds (default 1). */
  planksPerRelease?: number;
}

export interface GateSpec {
  zone: string;
  /** World position of the gate card. */
  pos: Vec2;
  asset: string;
  height: number;
  /** The big fog in front of it, world. */
  fogPos: Vec2;
  fogSize?: number;
  fogStretch?: number;
  /** Walking into this point finishes the chapter, world. */
  exit: Vec2;
}

export interface ChapterSpec {
  id: string;
  title: string;
  assetBase: string;
  seed: number;
  backdrop: BackdropLayer[];
  playerStart: { zone: string; pos: Vec3 | Vec2 };
  bridge: BridgeSpec | null;
  gate: GateSpec | null;
  assets: Record<string, AssetMeta>;
  terrain: TerrainSpec;
  zones: ZoneSpec[];
}

/** Checks the JSON and fills in defaults. Problems are collected, not thrown one by one. */
export function validateChapter(raw: unknown): { chapter: ChapterSpec; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, path: string, fallback = ''): string => {
    if (typeof v === 'string') return v;
    if (v !== undefined) errors.push(`${path} should be text`);
    return fallback;
  };
  const num = (v: unknown, path: string, fallback: number): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (v !== undefined) errors.push(`${path} should be a number`);
    return fallback;
  };
  const arr = <T>(v: unknown, path: string): T[] => {
    if (Array.isArray(v)) return v as T[];
    if (v !== undefined) errors.push(`${path} should be a list`);
    return [];
  };

  const id = str(r.id, 'id', 'chapter');
  if (!r.id) errors.push('id is missing');
  const zonesRaw = arr<Record<string, unknown>>(r.zones, 'zones');
  if (!zonesRaw.length) errors.push('zones: at least one zone is needed');

  const zones: ZoneSpec[] = zonesRaw.map((z, i) => {
    const zp = `zones[${i}]`;
    const zid = str(z.id, `${zp}.id`, `zone${i}`);
    if (!z.origin) warnings.push(`${zid}: no origin, using [0, 0]`);
    const areas = arr<[number, number, number, number]>(z.areas, `${zid}.areas`);
    if (!areas.length) warnings.push(`${zid}: no areas, using a 30 x 30 square`);
    return {
      id: zid,
      origin: (z.origin as Vec2) ?? [0, 0],
      neighbours: arr<string>(z.neighbours, `${zid}.neighbours`),
      areas: areas.length ? areas : [[-15, -15, 15, 15]],
      ground: arr<GroundSpec>(z.ground, `${zid}.ground`),
      props: arr<PropSpec>(z.props, `${zid}.props`),
      blockades: arr<BlockadeSpec>(z.blockades, `${zid}.blockades`),
      hints: arr<HintSpec>(z.hints, `${zid}.hints`),
      hiddenPaths: arr<HiddenPathSpec>(z.hiddenPaths, `${zid}.hiddenPaths`),
      fogWalls: arr<FogWallSpec>(z.fogWalls, `${zid}.fogWalls`),
      passages: arr<[number, number, number]>(z.passages, `${zid}.passages`),
      events: arr<ZoneEventSpec>(z.events, `${zid}.events`),
    };
  });

  const zoneIds = new Set(zones.map((z) => z.id));
  for (const z of zones) {
    for (const n of z.neighbours) if (!zoneIds.has(n)) errors.push(`${z.id}: unknown neighbour "${n}"`);
    for (const p of z.props) if (!p.asset) errors.push(`${z.id}: a prop has no asset`);
    for (const b of z.blockades) {
      if (!b.id || !b.text || !b.release) errors.push(`${z.id}: blockade needs id, text and release`);
      if (typeof b.points !== 'number') b.points = 10;
    }
  }

  const t = (r.terrain ?? {}) as Record<string, unknown>;
  const valley = t.valley as ValleySpec | undefined;
  if (!valley || !Array.isArray(valley.floors) || !valley.floors.length) errors.push('terrain.valley.floors is missing');
  if (valley && !valley.rim) errors.push('terrain.valley.rim is missing');
  const terrain: TerrainSpec = {
    valley: valley ?? { texture: 'textures/ground_grass', floors: [], centre: [0, 0], rim: { width: 10, side: 6, south: 2, north: 3 } },
    paths: arr(t.paths, 'terrain.paths'),
    water: arr(t.water, 'terrain.water'),
    chasms: arr(t.chasms, 'terrain.chasms'),
    passages: arr(t.passages, 'terrain.passages'),
  };

  const start = (r.playerStart ?? {}) as Record<string, unknown>;
  const startZone = str(start.zone, 'playerStart.zone', zones[0]?.id ?? '');
  if (!zoneIds.has(startZone)) errors.push(`playerStart.zone "${startZone}" is not a zone`);

  const bridge = (r.bridge as BridgeSpec | undefined) ?? null;
  if (bridge) {
    bridge.planksRequired = num(bridge.planksRequired, 'bridge.planksRequired', 5);
    bridge.planksTotal = num(bridge.planksTotal, 'bridge.planksTotal', 6);
    if (!bridge.from || !bridge.to) errors.push('bridge needs from and to');
  }

  const chapter: ChapterSpec = {
    id,
    title: str(r.title, 'title', id),
    assetBase: str(r.assetBase, 'assetBase', `/assets/${id}/`),
    seed: num(r.seed, 'seed', 1),
    backdrop: arr<BackdropLayer>(r.backdrop, 'backdrop'),
    playerStart: { zone: startZone, pos: (start.pos as Vec3) ?? [0, 0, 0] },
    bridge,
    gate: (r.gate as GateSpec | undefined) ?? null,
    assets: (r.assets as Record<string, AssetMeta>) ?? {},
    terrain,
    zones,
  };
  return { chapter, errors, warnings };
}

/** [x, z] from a [x, z] or [x, y, z] position. */
export function xz(p: Vec3 | Vec2 | undefined): Vec2 {
  if (!p) return [0, 0];
  return p.length === 3 ? [p[0], p[2]] : [p[0], p[1]];
}
