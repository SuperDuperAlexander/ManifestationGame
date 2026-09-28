import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { PALETTE, color4 } from '../config/palette';
import { InputManager } from './InputManager';
import { CameraRig } from './CameraRig';
import { AssetLoader } from './AssetLoader';
import { Walkability } from '../world/Walkability';
import { PlayerController } from '../player/PlayerController';
import { PlayerVisual } from '../player/PlayerVisual';
import { DebugOverlay } from '../ui/DebugOverlay';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { buildGreybox } from '../world/Greybox';

/**
 * Owns the engine, the scene and every system. One frame = one call to `frame()`.
 */
export class Game {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly input = new InputManager();
  readonly rig: CameraRig;
  readonly assets: AssetLoader;
  readonly walk = new Walkability();
  readonly player: PlayerController;
  readonly playerVisual: PlayerVisual;
  readonly debug: DebugOverlay;
  private time = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly ui: HTMLElement,
  ) {
    this.engine = new Engine(
      canvas,
      true,
      { stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance', audioEngine: false },
      true,
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = color4(PALETTE.ivory) as Color4;
    this.scene.skipPointerMovePicking = true;
    this.scene.skipPointerDownPicking = true;
    this.scene.skipPointerUpPicking = true;
    this.scene.autoClearDepthAndStencil = true;

    this.rig = new CameraRig(this.scene);
    this.assets = new AssetLoader(this.scene, './assets/ch1/');
    this.player = new PlayerController(this.input, this.walk);
    this.playerVisual = new PlayerVisual(this.scene);
    this.debug = new DebugOverlay(this.scene, ui);
    this.input.attach();

    window.addEventListener('resize', () => {
      this.engine.resize();
      this.rig.onResize();
    });
  }

  async start(): Promise<void> {
    await buildGreybox(this.scene, this.assets, this.walk);
    this.player.teleport(0, 0);
    this.rig.snapTo(this.player.position);
    this.engine.runRenderLoop(() => this.frame());
  }

  private frame(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 1 / 20);
    this.time += dt;
    WORLD_UNIFORMS.time = this.time;
    this.input.update();
    if (this.input.debugTogglePressed) this.debug.toggle();

    this.player.update(dt);
    this.playerVisual.root.position.copyFrom(this.player.position);
    this.playerVisual.update(dt, {
      speed: this.player.speed,
      speedRatio: this.player.speedRatio,
      heading: this.player.heading,
      breathLevel: 0,
      glow: 0,
      awake: 1,
    });
    this.rig.update(dt, this.player.position);

    this.debug.extra = {
      player: `${this.player.position.x.toFixed(1)}, ${this.player.position.z.toFixed(1)}`,
      horizon: this.rig.horizonFromTop.toFixed(2),
    };
    this.debug.update(dt);
    this.scene.render();
    this.input.endFrame();
  }
}
