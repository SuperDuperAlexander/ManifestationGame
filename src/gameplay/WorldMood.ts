import { TUNING } from '../config/tuning';
import type { Events } from '../core/Events';
import { damp, smoothstep } from '../core/Random';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import type { FogBlockade } from './FogBlockade';

/**
 * How bright and friendly the world feels. It is bright from the start. Coming near an active fog
 * darkens and pales it; walking away or breathing the fog thinner brings the light back.
 * Pushing a fog darkens everything further. Every release adds a warm golden lift.
 * Writes WORLD_UNIFORMS.mood, which every world shader reads.
 */
export class WorldMood {
  private released = 0;
  /** Shown release progress 0..1 (moves slowly toward released / total). */
  private progress = 0;
  /** Shown closeness to a fog 0..1. */
  private near = 0;
  private flash = 0;
  private stay = 0;

  constructor(
    events: Events,
    private readonly total: number,
  ) {
    const m = TUNING.mood;
    events.on('fogPushed', () => {
      this.flash = m.pushFlash;
      this.stay = Math.min(m.stayMax, this.stay + m.pushStay);
    });
    events.on('blockadeReleased', () => {
      this.released++;
      this.stay = 0;
    });
  }

  /** Inner light of the figure, 0..1: grows with every release. */
  get light(): number {
    return this.progress;
  }

  /**
   * `exhaled`: light breathed out this frame. `fog` / `distance`: the nearest active fog
   * and the distance to its edge.
   */
  update(dt: number, exhaled: number, fog: FogBlockade | null, distance: number): void {
    const m = TUNING.mood;
    const target = this.total > 0 ? Math.min(1, this.released / this.total) : 1;
    this.progress = Math.min(target, this.progress + dt * m.riseSpeed);
    this.flash *= Math.exp((-3 * dt) / m.flashTime);
    this.stay = Math.max(0, this.stay - exhaled * m.stayPerLight - dt * m.stayDecay);

    // Closer to a fog = darker. A thinner fog darkens less, so breathing brightens the world.
    const closeness = fog ? (1 - smoothstep(m.nearInner, m.nearOuter, distance)) * Math.min(1, fog.density) : 0;
    this.near += (closeness - this.near) * damp(m.nearSharpness, dt);

    const n = this.near;
    const p = smoothstep(0, 1, this.progress);
    WORLD_UNIFORMS.mood[0] = 1 - n * (1 - m.nearBrightness);
    WORLD_UNIFORMS.mood[1] = 1 - n * (1 - m.nearSaturation);
    WORLD_UNIFORMS.mood[2] = m.endWarmth * p * p * (1 - n);
    WORLD_UNIFORMS.mood[3] = Math.min(0.85, n * m.nearDark + this.flash + this.stay);
  }
}
