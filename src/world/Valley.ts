import type { ValleySpec } from '../types/chapter';

type Poly = [number, number][];
type Rect = [number, number, number, number];

/**
 * The shape of a closed valley: a flat floor (where the player walks) and hills that rise
 * around it. To the north the hills form a low ridge and then fall away, so the painted
 * backdrop shows behind the ridge. Pure maths from the chapter file: no meshes here.
 */
export class Valley {
  readonly floors: Poly[];
  /** Extra flat ground that is not walkable (the chasm and its rim). */
  private readonly flats: Rect[];
  /** Bounding box of the whole terrain grid, world metres. */
  readonly minX: number;
  readonly minZ: number;
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  private readonly heights: Float32Array;

  constructor(
    private readonly spec: ValleySpec,
    flats: Rect[],
  ) {
    this.floors = spec.floors.map((p) => p.map((q) => [q[0], q[1]] as [number, number]));
    this.flats = flats;
    const xs = [...this.floors.flat().map((p) => p[0]), ...flats.flatMap((r) => [r[0], r[2]])];
    const zs = [...this.floors.flat().map((p) => p[1]), ...flats.flatMap((r) => [r[1], r[3]])];
    const margin = spec.margin ?? 28;
    this.cell = spec.cell ?? 1;
    this.minX = Math.floor(Math.min(...xs) - margin);
    this.minZ = Math.floor(Math.min(...zs) - margin);
    this.cols = Math.ceil((Math.max(...xs) + margin - this.minX) / this.cell);
    this.rows = Math.ceil((Math.max(...zs) + margin - this.minZ) / this.cell);
    this.heights = new Float32Array((this.cols + 1) * (this.rows + 1));
    for (let j = 0; j <= this.rows; j++) {
      for (let i = 0; i <= this.cols; i++) {
        this.heights[j * (this.cols + 1) + i] = this.height(this.minX + i * this.cell, this.minZ + j * this.cell);
      }
    }
  }

  /** Grid height at vertex (i, j). */
  gridHeight(i: number, j: number): number {
    return this.heights[j * (this.cols + 1) + i]!;
  }

  /** Exact ground height at a point. */
  height(x: number, z: number): number {
    const d = this.distanceToFlat(x, z);
    if (d <= 0) return 0;
    const r = this.spec.rim;
    const [cx, cz] = this.spec.centre;
    const len = Math.hypot(x - cx, z - cz) || 1;
    const dirZ = (z - cz) / len;
    const north = smooth(0.25, 0.75, dirZ);
    const south = smooth(0.25, 0.75, -dirZ);
    const top = r.side * (1 - north - south) + r.north * north + r.south * south;
    const t = Math.min(d / r.width, 1);
    const beyond = Math.max(d - r.width, 0);
    // Soft rise to the rim, then a gentle climb on the sides, and a quick fall behind the north ridge.
    return top * smooth(0, 1, t) + beyond * 0.3 * (1 - north) - north * beyond * beyond * 0.4;
  }

  /** Smooth height from the precomputed grid (cheap, for per-frame use). */
  sample(x: number, z: number): number {
    const fx = (x - this.minX) / this.cell;
    const fz = (z - this.minZ) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.cols || fz >= this.rows) return -50;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = this.gridHeight(i, j);
    const b = this.gridHeight(i + 1, j);
    const c = this.gridHeight(i, j + 1);
    const d = this.gridHeight(i + 1, j + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  /** True if a body of this radius fits on the walkable floor here. */
  onFloor(x: number, z: number, radius: number): boolean {
    for (const p of this.floors) {
      if (insidePolygon(x, z, p) && edgeDistance(x, z, p) >= radius) return true;
    }
    return false;
  }

  /** 0 on flat ground, else metres to the nearest flat ground. */
  private distanceToFlat(x: number, z: number): number {
    let best = Infinity;
    for (const p of this.floors) {
      if (insidePolygon(x, z, p)) return 0;
      best = Math.min(best, edgeDistance(x, z, p));
    }
    for (const [x0, z0, x1, z1] of this.flats) {
      const dx = Math.max(x0 - x, 0, x - x1);
      const dz = Math.max(z0 - z, 0, z - z1);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  }
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

function insidePolygon(x: number, z: number, p: Poly): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i]!;
    const [xj, zj] = p[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function edgeDistance(x: number, z: number, p: Poly): number {
  let best = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, az] = p[j]!;
    const [bx, bz] = p[i]!;
    const vx = bx - ax;
    const vz = bz - az;
    const len2 = vx * vx + vz * vz;
    let t = len2 > 0 ? ((x - ax) * vx + (z - az) * vz) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    best = Math.min(best, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
  }
  return best;
}
