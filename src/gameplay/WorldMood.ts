import { TUNING } from '../config/tuning';
import type { Events } from '../core/Events';
import { smoothstep } from '../core/Random';
import { WORLD_UNIFORMS } from '../shaders/paperShader';

/**
 * How bright and friendly the world feels. It starts dim and pale; every released blockade
 * brings more light and colour. Pushing a fog darkens everything; exhaled light brings it back.
 * Writes WORLD_UNIFORMS.mood, which every world shader reads.
 */
export class WorldMood {
  private released = 0;
  /** Shown progress 0..1 (moves slowly toward released / total). */
  private progress = 0;
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

  /** Inner light of the world and the figure, 0..1 (shown value). */
  get light(): number {
    return this.progress;
  }

  /** `exhaled`: light breathed out this frame. */
  update(dt: number, exhaled: number): void {
    const m = TUNING.mood;
    const target = this.total > 0 ? Math.min(1, this.released / this.total) : 1;
    this.progress = Math.min(target, this.progress + dt * m.riseSpeed);
    this.flash *= Math.exp((-3 * dt) / m.flashTime);
    this.stay = Math.max(0, this.stay - exhaled * m.stayPerLight - dt * m.stayDecay);

    const p = smoothstep(0, 1, this.progress);
    WORLD_UNIFORMS.mood[0] = m.startBrightness + (1 - m.startBrightness) * p;
    WORLD_UNIFORMS.mood[1] = m.startSaturation + (1 - m.startSaturation) * p;
    WORLD_UNIFORMS.mood[2] = m.endWarmth * p * p;
    WORLD_UNIFORMS.mood[3] = Math.min(0.85, this.flash + this.stay);
  }
}
