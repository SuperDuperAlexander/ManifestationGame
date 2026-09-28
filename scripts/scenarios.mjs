// Extra browser-check scenarios. Loaded by scripts/check-browser.mjs.
export default function scenarios({ wait, shot, hold, page }) {
  const breathe = async (n) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.down('Space');
      await wait(4000);
      await page.keyboard.up('Space');
      await page.keyboard.down('ShiftLeft');
      await wait(4100);
      await page.keyboard.up('ShiftLeft');
    }
  };
  const tp = async (x, z) => {
    await page.evaluate(([x, z]) => {
      const g = window.__lw.game;
      g.player.teleport(x, z);
      g.rig.snapTo(g.player.position);
    }, [x, z]);
    await wait(1800);
  };
  const pz = () => page.evaluate(() => window.__lw.game.player.position.z);
  let cdp = null;
  const touch = async (type, points) => {
    cdp ??= await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  };
  return {
    async play() {
      // Intro, then walk into the forest and dissolve the first fog by real breathing.
      await wait(22000);
      await shot('x1-after-intro');
      await tp(5, -9.5);
      await wait(4000);
      await hold('KeyW', 500);
      await wait(6000);
      await shot('x2-teaching');
      await breathe(3);
      await wait(1500);
      const light = await page.evaluate(() => window.__lw.game.lightPoints.total);
      console.log('light after 3 real breaths:', light, '(expect 10)');
      await shot('x3-released');
      await tp(6, 8);
      await page.evaluate(() => window.__lw.game.debugReleaseLoaded());
      await tp(0, 17);
      await wait(14000);
      await hold('KeyW', 8000);
      await wait(1500);
      await shot('x4-gate');
      await wait(4000);
      await shot('x5-card');
      const card = await page.evaluate(() => document.querySelector('.transition')?.className);
      console.log('transition state:', card);
    },
    async mvp() {
      // The MVP level step by step: push the first fog, breathe it away, then the second, then the bridge.
      // Waits for game state, so it works on slow (software) rendering too.
      const G = (fn, arg) => page.evaluate(fn, arg);
      const breathe = async () => {
        await page.keyboard.down('Space');
        await page.waitForFunction(() => window.__lw.game.breath.breathLevel > 0.97, null, { timeout: 60000 });
        await page.keyboard.up('Space');
        await page.keyboard.down('ShiftLeft');
        await page.waitForFunction(() => window.__lw.game.breath.breathLevel < 0.03, null, { timeout: 60000 });
        await page.keyboard.up('ShiftLeft');
      };
      const state = () =>
        G(() => {
          const g = window.__lw.game;
          const x = window.__lw.stats().extra;
          return { light: g.lightPoints.total, mood: x.mood, fog: x.fog };
        });
      const release = async (id, label) => {
        for (let i = 1; i <= 4; i++) {
          await breathe();
          const s = await state();
          console.log(`${label} breath ${i}:`, JSON.stringify(s));
          if (await G((id) => window.__lw.game.fogs.isReleased(id), id)) break;
        }
      };
      await shot('m0-start');
      console.log('start', JSON.stringify(await state()));
      await tp(5, -9.8);
      await shot('m1-fog1');
      // Wait for the push cooldown in game time, so every press counts even on slow rendering.
      for (let i = 0; i < 3; i++) {
        await page.waitForFunction(() => window.__lw.game.fogs.get('b_worthy').pushes >= 0, null);
        const before = await G(() => window.__lw.game.fogs.get('b_worthy').pushes);
        while ((await G(() => window.__lw.game.fogs.get('b_worthy').pushes)) === before) {
          await page.keyboard.down('KeyE');
          await wait(250);
          await page.keyboard.up('KeyE');
          await wait(250);
        }
        if (i === 0) await shot('m2a-first-push');
      }
      await wait(400);
      await shot('m2-pushed');
      console.log('after 3 pushes', JSON.stringify(await state()),
        'grow', await G(() => window.__lw.game.fogs.get('b_worthy').grow.toFixed(2)));
      await release('b_worthy', 'fog 1');
      await wait(600);
      await shot('m3-beam');
      await wait(2500);
      await shot('m4-after-release');
      await tp(6, 7.5);
      await shot('m5-fog2');
      await release('b_angry', 'fog 2');
      await wait(600);
      await shot('m6-beam2');
      await wait(3000);
      await shot('m7-bright');
      await tp(0, 17);
      await page.waitForFunction(() => window.__lw.game.bridge.isWalkable, null, { timeout: 180000 });
      await shot('m8-bridge');
      console.log('end', JSON.stringify(await state()), 'planks', await G(() => window.__lw.game.bridge.plankCount));
    },
    async mobile() {
      const vp = page.viewportSize();
      await shot('m1-start');
      // Joystick: press on the left, drag up.
      const jx = vp.width * 0.25;
      const jy = vp.height * 0.7;
      await touch('touchStart', [[jx, jy]]);
      for (let i = 1; i <= 6; i++) {
        await touch('touchMove', [[jx, jy - i * 10]]);
        await wait(30);
      }
      await wait(1500);
      await shot('m2-joystick');
      const z1 = await page.evaluate(() => window.__lw.game.player.position.z);
      await touch('touchEnd', []);
      console.log('walked north with joystick to z =', z1.toFixed(2));
      // Breath button: hold 4 s, then let go.
      const b = await page.evaluate(() => {
        const r = document.querySelector('.breath-button').getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      });
      await touch('touchStart', [b]);
      await wait(3500);
      await shot('m3-inhale');
      const s1 = await page.evaluate(() => [window.__lw.game.breath.state, window.__lw.game.breath.breathLevel]);
      await touch('touchEnd', []);
      await wait(1500);
      const s2 = await page.evaluate(() => [window.__lw.game.breath.state, window.__lw.game.breath.breathLevel]);
      await shot('m4-exhale');
      console.log('holding button:', JSON.stringify(s1), 'after letting go:', JSON.stringify(s2));
      await wait(3000);
      const st = await page.evaluate(() => window.__lw.stats());
      console.log('mobile stats', st.fps, 'fps', st.drawCalls, 'draws, scaling', st.scaling.toFixed(3));
    },
    async partial() {
      // Waits for game events instead of fixed times, so it also works on slow (software) rendering.
      const g = (fn) => page.evaluate(fn);
      const walkNorthUntil = async (z, ms) => {
        await page.keyboard.down('KeyW');
        await page.waitForFunction((z) => window.__lw.game.player.position.z > z, z, { timeout: ms }).catch(() => {});
        await page.keyboard.up('KeyW');
      };
      await tp(4, -10);
      const n = await page.evaluate(() => ['b_worthy'].filter((id) => window.__lw.game.fogs.debugRelease(id)).length);
      console.log('released blockades', n);
      await tp(0, 17);
      await page.waitForFunction(() => window.__lw.game.bridge.plankCount >= 3, null, { timeout: 120000 });
      await walkNorthUntil(21, 15000);
      console.log('with 3 planks, z =', (await pz()).toFixed(2), '(must stay below 20)');
      await shot('p1-half-bridge');
      await tp(6, 8);
      await g(() => window.__lw.game.fogs.debugRelease('b_angry'));
      await tp(0, 17);
      await page.waitForFunction(() => window.__lw.game.bridge.isWalkable, null, { timeout: 120000 });
      await shot('p2-five-planks');
      await walkNorthUntil(27.5, 90000);
      console.log('with 6 planks, z =', (await pz()).toFixed(2), '(must be above 27)');
      await shot('p3-crossed');
    },
    async finale() {
      // Release all blockades zone by zone (test helper), then walk to the gate.
      for (const [x, z] of [[5, -9.5], [6, 8]]) {
        await tp(x, z);
        const n = await page.evaluate(() => window.__lw.game.debugReleaseLoaded());
        console.log('released', n);
        await wait(1500);
      }
      await shot('g0-last-release');
      await tp(0, 17);
      await wait(3000);
      await shot('g1-at-chasm');
      await wait(8000);
      await shot('g2-planks');
      await wait(6000);
      await shot('g3-bridge-done');
      await hold('KeyW', 2600);
      await shot('g4-on-bridge');
      await hold('KeyW', 2600);
      await shot('g5-far-side');
      await wait(3000);
      await shot('g6-gate-open');
      await hold('KeyW', 2500);
      await wait(1200);
      await shot('g7-transition');
      await wait(4000);
      await shot('g8-card');
      const st = await page.evaluate(() => window.__lw.stats());
      console.log('finale', JSON.stringify(st.extra));
    },
    async meshes() {
      await tp(0, -6);
      const names = await page.evaluate(() => window.__lw.game.scene.getActiveMeshes().data.slice(0, window.__lw.game.scene.getActiveMeshes().length).map((m) => m.name));
      const groups = {};
      for (const n of names) {
        const k = n.split(':')[0] + (n.includes(':') ? ':' + n.split(':')[1] : '');
        groups[k] = (groups[k] || 0) + 1;
      }
      console.log(JSON.stringify(groups, null, 0));
      const st = await page.evaluate(() => window.__lw.stats());
      console.log('draw', st.drawCalls, 'active', st.activeMeshes);
    },
    async tour() {
      const spots = [
        ['t1-start', -16, -20],
        ['t2-meadow', 2, -14],
        ['t3-ford', 5, -10],
        ['t4-middle', -5, 1],
        ['t5-middle-west', -12, 4],
        ['t6-before-pass', 5, 7],
        ['t7-pass', 6, 14.5],
        ['t8-chasm', 0, 17],
        ['t9-landing', 0, 30],
        ['t10-east', 22, -2],
      ];
      for (const [name, x, z] of spots) {
        await tp(x, z);
        await shot(name);
        const st = await page.evaluate(() => window.__lw.stats());
        console.log(name, 'draw', st.drawCalls, 'fps', st.fps, 'zones', st.loadedZones.join(','));
      }
    },
    async closeup() {
      const clip = { x: 490, y: 300, width: 300, height: 260 };
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c1-idle.png`, clip });
      await page.keyboard.down('KeyS');
      await wait(700);
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c2-walk-south.png`, clip });
      await page.keyboard.up('KeyS');
      await page.keyboard.down('KeyW');
      await wait(700);
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c3-walk-north.png`, clip });
      await page.keyboard.up('KeyW');
      await page.keyboard.down('KeyD');
      await wait(700);
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c4-walk-east.png`, clip });
      await page.keyboard.up('KeyD');
      await page.keyboard.down('Space');
      await wait(3000);
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c5-inhale.png`, clip });
      await page.keyboard.up('Space');
    },
    async intro() {
      await shot('i1-lying');
      await wait(4200);
      await shot('i2-awake');
      await wait(3500);
      await shot('i3-fairy-arrives');
      await wait(5000);
      await shot('i4-intro-line');
      await wait(9000);
      await shot('i5-intro-end');
      await hold('KeyW', 1800);
      await wait(2500);
      await shot('i6-teaching');
      await wait(6000);
      await shot('i7-teaching-2');
    },
    async fog() {
      await shot('f1-start');
      await hold('KeyW', 1300);
      await shot('f2-near-fog');
      await hold('KeyW', 900);
      await wait(300);
      await shot('f3-pushed');
      await page.keyboard.press('KeyE');
      await wait(400);
      await shot('f4-struck');
      await hold('KeyS', 300);
      await breathe(1);
      await shot('f5-after-one-breath');
      await breathe(1);
      // Third breath: dissolves early in the exhale.
      await page.keyboard.down('Space');
      await wait(4000);
      await page.keyboard.up('Space');
      await page.keyboard.down('ShiftLeft');
      await page.waitForFunction(() => window.__lw.game.lightPoints.total > 0, null, { timeout: 8000 });
      await wait(300);
      await shot('f6-dissolving');
      await wait(1200);
      await shot('f7-release-text');
      await page.keyboard.up('ShiftLeft');
      await wait(3500);
      await shot('f8-after');
    },
    async breath() {
      await page.keyboard.down('Space');
      await wait(2000);
      await shot('b1-inhale-2s');
      await wait(2000);
      await shot('b2-inhale-4s');
      await page.keyboard.up('Space');
      await page.keyboard.down('ShiftLeft');
      await wait(1200);
      await shot('b3-exhale');
      await wait(3000);
      await page.keyboard.up('ShiftLeft');
      await wait(500);
      await shot('b4-after');
      await hold('KeyW', 600);
    },
  };
}
