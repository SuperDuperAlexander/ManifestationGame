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
