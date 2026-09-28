/**
 * Every tunable number of the game lives here: speeds, radii, timings.
 * Units: metres, seconds, radians unless the name says otherwise.
 */
export const TUNING = {
  camera: {
    /** Angle from above, in degrees. CLAUDE.md asks for 35–45. */
    pitchDeg: 38,
    /** Distance from the look-at point to the camera. */
    distance: 18,
    /** Vertical field of view on landscape screens. */
    fov: 0.72,
    /** Vertical field of view on portrait screens (phones held upright). */
    fovPortrait: 1.0,
    /** The camera looks at a point this far ahead of the player (north). */
    lookAhead: 2.5,
    /** Height of the look-at point above the ground. */
    lookHeight: 1.0,
    /** How fast the camera catches up. Higher = snappier. */
    followSharpness: 3.2,
    maxZ: 160,
    /** 0 = normal perspective, 1 = vertical lines stay fully vertical on screen. */
    verticalCorrection: 0,
  },

  /**
   * World curvature. The ground bends down beyond a distance ahead of the camera,
   * so the horizon and the painted backdrop become visible from a steep camera.
   */
  curve: {
    /** Flat zone in front of the look-at point. Nothing bends inside it. */
    flatDistance: 7,
    /** Drop = strength * (distance beyond the flat zone)^2. */
    strength: 0.02,
    /** Haze on the world near the horizon: 0 = none. */
    hazeAmount: 0.42,
    /** Haze starts this far beyond the flat zone ... */
    hazeStart: 4,
    /** ... and is full this far beyond it. */
    hazeEnd: 22,
  },

  backdrop: {
    /** Distance of the backdrop planes from the camera. Only affects nothing but depth range. */
    distance: 120,
    /**
     * Horizontal parallax: how many screen widths a layer shifts per metre the camera moves,
     * multiplied by (1 - layer parallax factor).
     */
    shiftPerMetre: 0.006,
    /** Extra width of each layer, as a share of the screen width, so shifting never shows an edge. */
    overscan: 0.7,
    /** Mountain layers: how far their image bottom sits below the horizon line, in screen heights. */
    sinkBelowHorizon: 0.06,
  },

  player: {
    walkSpeed: 3.6,
    acceleration: 9,
    deceleration: 11,
    turnSharpness: 10,
    radius: 0.4,
    /** Size of the figure. 1 = about 1.15 m tall. */
    visualScale: 1.2,
  },

  cards: {
    /** Paper cards lean back by this angle so they face the camera a bit more. Degrees. */
    leanBackDeg: 32,
    alphaCutoff: 0.5,
    /** Free variation per prop instance. */
    scaleJitter: 0.15,
    brightnessJitter: 0.06,
    warmthJitter: 0.04,
    /** Y rotation jitter in degrees. */
    rotationJitterDeg: 6,
  },

  ground: {
    /** Metres covered by one repeat of a ground texture. */
    grassTile: 7,
    pathTile: 5,
    stoneTile: 5,
    waterTile: 6,
    /** Soft painted edge width of path and plaza overlays, in metres. */
    edgeSoftness: 1.2,
    waterFlowSpeed: 0.12,
  },

  breath: {
    /** Target rhythm: seconds in, seconds out. */
    inhaleTarget: 4,
    exhaleTarget: 4,
    /** Breath level change per second while inhaling / exhaling (1 = full in 1 s). */
    inhaleRate: 1 / 4,
    exhaleRate: 1 / 4,
    /** Breath level falls back to 0 this fast when idle. */
    idleDecay: 0.35,
    /** A phase shorter than this is ignored for scoring. */
    minScoredPhase: 0.8,
    /** Light an exhale gives = level spent * (base + rhythmBonus * rhythmScore). */
    lightBase: 0.6,
    rhythmBonus: 0.6,
    /** Player's light radius: base, plus this much at full breath. */
    lightRadiusBase: 1.6,
    lightRadiusGain: 3.6,
    /** Exhaled light reaches fog within this distance. */
    reach: 7.5,
  },

  fog: {
    /** How much density one full, perfect exhale removes. */
    densityPerLight: 0.42,
    /** Push: density rises this much for a moment ... */
    pushSurge: 0.35,
    pushSurgeTime: 1.0,
    /** ... and this much stays. Force makes it stronger. */
    pushPermanent: 0.04,
    maxDensity: 1.25,
    /** The fog is soft but you cannot walk through it. */
    colliderRadius: 1.9,
    /** Walking into it counts as a push when the body is closer than this to its edge. */
    pushDistance: 0.75,
    /** Pressing E counts as a push when closer than this. */
    strikeDistance: 4.5,
    pushCooldown: 1.2,
    releaseTextTime: 2.2,
    wobbleDecay: 3.0,
  },

  fairy: {
    orbitRadius: 1.5,
    orbitHeight: 1.7,
    orbitSpeed: 0.7,
    bobAmplitude: 0.12,
    flySpeed: 7,
    followSharpness: 4,
    /** Distance at which a hint or blockade calls her. */
    hintRange: 9,
    hintHold: 3.6,
    /** Seconds a line stays on screen, plus a little per character. */
    lineBase: 2.4,
    linePerChar: 0.05,
    /** Silence between two lines. */
    lineGap: 0.7,
    introDelay: 1.2,
  },

  bridge: {
    plankAppearTime: 1.1,
    plankWidth: 2.6,
    /** Delay between two planks when several appear together. */
    plankStagger: 0.5,
  },

  gate: {
    /** Seconds of the light-and-fog blend between chapters. */
    transitionTime: 2.6,
    triggerRadius: 1.8,
  },

  streaming: {
    /** Zones are checked this often, in seconds. */
    checkInterval: 0.4,
  },

  performance: {
    /** Hardware scaling on phones: 1 = native pixels. Higher = fewer pixels. */
    mobileScalingMin: 1.25,
    mobileScalingMax: 2,
    /** Below this fps (averaged), scaling goes up one step. */
    lowFps: 38,
    highFps: 56,
    adaptInterval: 2.5,
  },
} as const;
