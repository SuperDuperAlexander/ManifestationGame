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

## Milestone 7 — Mobile

**D22. Touch controls appear only on touch screens** (or with `?touch` in the address).
Joystick: touch anywhere on the left half, it appears under the finger. Breath: one round button
bottom right; hold = breathe in, let go = the breath flows out by itself. A short tap on the right
half next to a fog counts as a push. The rhythm guide sits on the breath button.

**D23. "Hardware scaling" is measured against the phone's own pixels.** CLAUDE.md asks for 1.5–2.
Taken literally (CSS pixels) that would be very blurry on modern phones, so the game renders at
1 rendered pixel per 1.25–2 device pixels. It starts at 1.5 and adapts every 2.5 s:
below 38 fps it renders fewer pixels, above 56 fps more. Desktop renders at full sharpness (max 2×).
Settings: `TUNING.performance`, `src/core/Performance.ts`.

**D24. Portrait phones get a wider view** (vertical field of view 1.0 instead of 0.72),
so enough of the world fits left and right.

## After playing — the valley (Alexander's feedback, 2026-09-28)

**D25. The world bend (D4, D14) is gone.** It made the world look like a ball. Instead, chapter 1 is
**one closed valley** (about 66 × 42 m instead of 140 × 70 m): a flat floor with soft hills around it.
East and west hills are high (7 m), the south rim near the camera is low (2.2 m), and to the north the
hills form a low ridge (3.2 m) and then fall away. The painted backdrop shows behind that ridge.
Shape and heights come from `terrain.valley` in `ch1.json`; the maths is in `src/world/Valley.ts`.

**D26. The player can walk everywhere on the valley floor.** Paths are only painted on the ground now.
Only trees, stones, fog, water and the valley edge stop the player. The floor outline is
`terrain.valley.floors` (a second outline is the ledge with the gate, beyond the chasm).

**D27. Camera: still fixed (not rotatable), but lower and a bit wider** (22° from above, field of view 0.8,
16 m away). Alexander chose this over a Messenger-style camera that turns: a turning camera would show
the paper cards from the side and flip the painted light. This replaces the 35–45° in `CLAUDE.md` section 4.
Paper cards now lean back 16°. Settings: `TUNING.camera`, `TUNING.cards.leanBackDeg`.

**D28. The backdrop sits on the ridge.** Each frame the camera finds where the valley ridge meets the sky
on screen, and the backdrop layers move up and down with it. Far layers follow a bit less
(`follow` in the backdrop entries), so more mountain shows as you walk north.

**D29. Trees and ruins turn see-through where they hide the player** (a soft dotted hole).
With the lower camera, tall cards in front of the player would hide the red figure.
Setting: `TUNING.cards.seeThroughRadius`.

**D30. One draw call per image for all loaded zones.** In the valley all six zones are visible at once,
so each zone drawing its own trees cost about 100 draw calls. Now all loaded zones share one card set
per image: 39–65 draw calls. Streaming still loads and unloads zones as before.

**D31. Hills get a painted shade** (brighter on slopes facing right, darker facing left), baked into
the ground mesh like the light in the art. Setting: `TUNING.ground.slopeShade`.

**D32. Test switches:** `scripts/check-browser.mjs` can use an installed Chromium with
`CHROMIUM_PATH=/path/to/chromium`. The `partial` scenario waits for game events instead of fixed
times, so it also works on slow computers.

## MVP level (Alexander's brief, 2026-09-28)

**D33. Chapter 1 is a short MVP level** with one winding path from the meadow to the chasm and
two fogs: "I'm not worthy" on the ford over the river, "I'm angry" in the pass between two hill ridges.
The player can walk anywhere on the floor, but the river and the ridges leave only one way through,
and each fog closes it. The larger chapter (6 fogs) comes back later. New valley option: `ridges`
(extra hill lines inside the valley). Level: `public/data/chapters/ch1.json`.

**D34. Two calm breaths dissolve a fog** (`TUNING.fog.densityPerLight` 0.72). 10 light points each.
The bridge needs both: each release adds 3 planks (`planksPerRelease`), 6 are needed.

**D35. The world mood** (`src/gameplay/WorldMood.ts`): the valley starts pale and a little dim
(brightness 0.8, colour 0.62). Every release makes it brighter, more colourful and, at the end, warm.
All world shaders read it. Settings: `TUNING.mood`.

**D36. Force makes it worse, visibly.** Each push darkens the whole world (a dark flash, and a part
that stays), and the fog grows bigger and darker (up to +80 %) and pushes the player back a little.
Breathing out brings the light back and shrinks the fog again.

**D37. The release:** a golden beam of light from the sky onto the fog, sparks falling down,
a glow on the ground (`src/gameplay/LightBeam.ts`). The figure lights up, and keeps a soft inner
light that grows with every release (`TUNING.mood.playerLight`).

**D38. The fairy teaches force first.** At the first fog she says "Try to push it away first."
After the first push: "See? Force only makes it grow." and then how to breathe. If the player does
not push within 14 s, or finds breathing alone, she explains breathing anyway.

**D39. The fairy shows the way.** When the player lingers for 14 s without getting closer to the next
goal (next fog, then the bridge, then the gate), she flies a little way toward it: "This way. Follow the path."
Settings: `TUNING.guide`.

**D40. The bridge builds only when it is complete** (replaces D18 for this level): nothing appears
until all needed planks are earned (both fogs). Then, when the player comes within 9 m of the bridge
start (`TUNING.bridge.nearDistance`), the planks appear one after another.

**D41. The mood follows the fog, not the progress** (replaces the start values of D35): the world is
bright from the start. Near an active fog it grows darker and paler (from 16 m, full at 3 m); walking
away brings the light back. A fog breathed thinner darkens less, so breathing brightens the world.
Pushing still darkens further (D36). Each release adds a warm golden lift. Settings: `TUNING.mood`.

**D42. The new figure from `figure-kit/` is the player now** (`src/player/PlayerVisual.ts`,
`src/player/ScarfTail.ts`): a cloak that trails and swings (a spring), soft folds, a hood with a face,
a scarf with real physics, legs and boots, leaning, nodding and looking around. Its numbers moved to
`TUNING.figure`. It uses the game's own toon shader (so the world mood darkens it near a fog) and the
game's halo, which also shows the inner light (D37). The old figure is in `legacy/figure-v1/`.
`figure-kit/` stays as Alexander's standalone demo; changes there do not reach the game by themselves.

**D43. Wind:** paper cards sway in a soft breeze, in the shader (no extra draw calls): the foot stays,
the top moves, a slow gust rolls across the valley, and it leans to the left (the breeze comes from the right,
like the light). How much each image sways is data: `sway` per asset in `ch1.json` (grass 0.1, flowers 0.09,
bush 0.03, trees 0.012–0.025; rocks, ruins and the gate stay still). Global strength: `TUNING.wind.strength`.

**D44. Birds in the sky** (`src/world/SkyBirds.ts`): now and then a flock of 3–6 drawn birds crosses the
screen in a loose V, flapping and gliding, above the valley ridge and in front of the painted mountains.
One draw call. Settings: `TUNING.birds`.
