# Decisions

Alexander asked Claude to make open design decisions and write them down.
Each entry: what was decided, why, and how to change it.

## Milestone 1 — Setup + greybox

**D1. Old code is copied to `legacy/`, not moved.**
The old full-3D game lives in a separate folder and git repo (`../GameLightWithin`).
Its source, tests and docs are copied into `legacy/GameLightWithin/`. The original folder is untouched.
The old note `public/teachings/` moved to `legacy/teachings/`. The fonts in `public/fonts/` are reused.

**D2. "Transparent" means alpha ≤ 4 when trimming props.**
The prop PNGs carry invisible dust pixels (alpha 1–4) out to the image border, so a strict
"alpha = 0" trim removed nothing. The converter treats alpha ≤ 4 as transparent and clears it in
the WebP. The PNG originals are never changed. Setting: `ALPHA_DUST` in `scripts/convert-assets.mjs`.

**D3. WebP files are not in git.** They are generated from the PNGs by `npm run assets`,
which runs automatically before `dev` and `build`.

**D4. The world bends down toward the horizon.**
A camera looking down at 35–45° never sees the sky: the painted backdrop would be invisible.
So the ground bends down beyond a flat zone in front of the player (like in Animal Crossing).
The horizon becomes visible at the top of the screen and the backdrop layers sit behind it.
Far zones disappear behind the bend by themselves, which also helps performance.
It is done in the shared vertex shader (`src/shaders/paperShader.ts`).
Settings: `TUNING.curve` in `src/config/tuning.ts`.

**D5. Camera: 38° from above, 18 m away, looking north. Paper cards lean back 32°.**
Perfectly vertical cards looked skewed (like parallelograms) from a camera that looks down.
Leaning them back so they almost face the camera keeps them undistorted, like pictures in a diorama.
Babylon's projection-plane tilt was tested and rejected (it cut off the bottom of the screen).
Settings: `TUNING.camera`, `TUNING.cards.leanBackDeg`.

**D6. Playwright is a dev dependency.** It opens the game in a real browser for the automatic
checks after each milestone (`npm run check:browser`). It is not part of the game.

**D7. `vite.config.ts` is not type-checked by `tsc`.** Type-checking it needs `@types/node`,
one more dependency for no gain. Vite checks it when it runs.

## Milestone 4 — Fairy

**D8. Dialogue is a calm line at the bottom of the screen**, not a speech bubble in the world.
It stays readable on phones and never hides behind trees.

**D9. Sounds are synthesized (Web Audio), no audio files yet.** A soft chime for hints and a warm
chord for a released fog. Real music and samples can plug into `src/core/Sound.ts` later (milestone 8).

**D10. A small start screen ("press any key or tap").** Browsers only allow sound after a key press
or tap, and the player should wake up on the meadow only when someone is watching.

**D11. Glow is made with soft additive light cards, not Babylon's GlowLayer.**
The GlowLayer would draw the un-bent world (see D4), so glows would float in the wrong place.
Light cards bend with the world and cost almost nothing on phones.

## Milestone 5 — Data-driven chapter

**D12. The chapter file format is extended** (all in `src/types/chapter.ts`):
zones have an `origin` (world position) and walkable `areas`; `terrain` holds the base ground,
the paths between zones, the river and the chasm; `assets` holds each prop's default height,
collider and shadow; `props` support rows (`line` + `count`) and scatters.
`scale` means the card height in metres.

**D13. Backdrop layers hang in front of the camera and are placed in screen space.**
The sky covers the top of the screen; mountains span the width and are sunk below the horizon
so only their upper part shows ("rise" = how far above the horizon, in screen heights).
The mountain images do not tile, so each layer is one wide copy. Parallax moves layers sideways
with the camera (near layers more than far ones). Order is fixed with `alphaIndex` 0–4.

**D14. Camera 36°, stronger bend.** The sky now takes about a quarter of the screen.
The chasm is 8 m wide and the gate stands 8 m behind it, so the gate is visible from the bridge.

**D15. Streaming uses the zone `neighbours` from the file**, plus a 3-second grace time before a
zone is unloaded. Neighbours include zones that can be seen from a zone, not only those joined by a path.

**D16. Culling per prop group.** Every tree group, fog and ground piece is hidden when it is off screen
or sunk behind the bent horizon. This keeps draw calls between about 30 and 60 (budget: 100).

**D17. New fairy lines** (drafts, please check): hints for the start, oak, well, forest, ruins,
monolith, river, ford, hidden path and chasm, plus short lines after each release. All in `en.json`.

## Milestone 6 — Bridge and gate

**D18. Planks appear when you are at the chasm**, one after another, even if the fogs were released
long before. So you always see the bridge being built. Each plank plays a soft tone.

**D19. 5 of 6 planks make the bridge walkable** (`planksRequired: 5`). The missing plank is filled by a
faint thread of light. The sixth fog makes the bridge complete and brighter.

**D20. The gate opens when the bridge is walkable.** The big fog in front of it dissolves, the gate glows,
and walking into it plays the light-and-fog blend (2.6 s), then a calm "Chapter complete" card.
There is no chapter 2 yet, so the card stays. Reload the page to play again.

**D21. Old hints are skipped.** If the player walked away before the fairy could show a hint,
she does not show it later somewhere else. After a release she only speaks if she is not talking already.
