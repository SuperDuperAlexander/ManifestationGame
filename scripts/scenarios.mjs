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
  return {
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
