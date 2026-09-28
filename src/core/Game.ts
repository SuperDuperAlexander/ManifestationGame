import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { PALETTE, color4 } from '../config/palette';
import { TUNING } from '../config/tuning';
import { InputManager } from './InputManager';
import { CameraRig } from './CameraRig';
import { AssetLoader } from './AssetLoader';
import { Walkability } from '../world/Walkability';
import { PlayerController } from '../player/PlayerController';
import { PlayerVisual } from '../player/PlayerVisual';
import { DebugOverlay } from '../ui/DebugOverlay';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { buildGreybox } from '../world/Greybox';
import { BreathSystem } from '../player/BreathSystem';
import { BreathVisuals } from '../player/BreathVisuals';
import { BreathGuide } from '../ui/BreathGuide';
import { Events } from './Events';
import { FogField } from '../gameplay/FogField';
import { LightPoints } from '../gameplay/LightPoints';
import { DialogueSystem } from '../companion/DialogueSystem';
import { Hud } from '../ui/Hud';

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
  readonly breath = new BreathSystem();
  readonly breathVisuals: BreathVisuals;
  readonly breathGuide: BreathGuide;
  readonly events = new Events();
  readonly fogs: FogField;
  readonly lightPoints: LightPoints;
  readonly dialogue: DialogueSystem;
  readonly hud: Hud;
  /** True on touch devices: letting go of the breath button breathes out. */
  touchMode = false;
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
    this.breathVisuals = new BreathVisuals(this.scene);
    this.breathGuide = new BreathGuide(ui);
    this.fogs = new FogField(this.scene, this.walk, this.events);
    this.lightPoints = new LightPoints(this.events);
    this.hud = new Hud(ui, this.events);
    this.dialogue = new DialogueSystem(ui, this.events);
    this.events.on('fogPushed', () => void this.dialogue.say('force', { interrupt: true }));
    this.input.attach();

    window.addEventListener('resize', () => {
      this.engine.resize();
      this.rig.onResize();
    });
  }

  async start(): Promise<void> {
    await Promise.all([
      document.fonts.load('400 64px "Work Sans"'),
      document.fonts.load('700 64px "Work Sans"'),
      this.dialogue.load('./data/dialogue/en.json'),
    ]);
    await buildGreybox(this.scene, this.assets, this.walk, this.fogs);
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

    this.breath.update(dt, {
      inhale: this.input.inhaleHeld,
      exhale: this.input.exhaleHeld,
      releaseExhales: this.touchMode,
    });
    // Breathing slows the walk: a calm pace to go with the breath.
    this.player.speedFactor = this.breath.state === 'idle' ? 1 : 0.7;
    this.player.update(dt);
    this.fogs.update(dt, this.player, this.breath, this.input.pushPressed);
    this.breathVisuals.target = this.fogs.hasTarget ? this.fogs.streamTarget : null;
    this.breathVisuals.update(dt, this.breath, this.player.position);
    this.breathGuide.wanted = this.fogs.nearestDistance < TUNING.breath.reach + 2;
    WORLD_UNIFORMS.revealX = this.player.position.x;
    WORLD_UNIFORMS.revealZ = this.player.position.z;
    WORLD_UNIFORMS.revealRadius = this.breath.lightRadius;

    this.playerVisual.root.position.copyFrom(this.player.position);
    this.playerVisual.update(dt, {
      speed: this.player.speed,
      speedRatio: this.player.speedRatio,
      heading: this.player.heading,
      breathLevel: this.breath.breathLevel,
      glow: this.breathVisuals.glow,
      awake: 1,
    });
    this.breathGuide.update(dt, this.breath);
    this.dialogue.update(dt);
    this.hud.update(dt);
    this.rig.update(dt, this.player.position);

    this.debug.extra = {
      player: `${this.player.position.x.toFixed(1)}, ${this.player.position.z.toFixed(1)}`,
      horizon: this.rig.horizonFromTop.toFixed(2),
      breath: `${this.breath.state} ${this.breath.breathLevel.toFixed(2)}`,
      rhythm: this.breath.rhythmScore.toFixed(2),
      breaths: this.breath.breaths,
      light: this.lightPoints.total,
      fog: this.fogs.nearest ? `${this.fogs.nearest.id} d=${this.fogs.nearest.density.toFixed(2)}` : '-',
    };
    this.debug.update(dt);
    this.scene.render();
    this.input.endFrame();
  }
}
