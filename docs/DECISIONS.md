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
