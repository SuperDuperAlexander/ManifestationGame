import type { Scene } from '@babylonjs/core/scene';
import type { AssetLoader } from '../core/AssetLoader';
import { Random } from '../core/Random';
import { TUNING } from '../config/tuning';
import { createPaperMaterial } from '../shaders/paperShader';
import { createGroundRect } from './Ground';
import { PaperCardSet, type CardInstance } from './PaperCard';
import type { Walkability } from './Walkability';
import type { FogField } from '../gameplay/FogField';
import type { Companion } from '../companion/Companion';

/**
 * Milestone 1 test scene: flat ground and placeholder props.
 * Replaced by the data-driven chapter in milestone 5.
 */
export async function buildGreybox(
  scene: Scene,
  assets: AssetLoader,
  walk: Walkability,
  fogs: FogField,
  companion: Companion,
): Promise<void> {
  const grass = await assets.acquire('textures/ground_grass', { wrap: true, anisotropy: 4 });
  const ground = createGroundRect('greybox.ground', scene, 0, 10, 140, 120, 0, 2);
  ground.material = createPaperMaterial('greybox.groundMat', scene, {
    texture: grass.texture,
    worldTile: TUNING.ground.grassTile,
  });
  walk.areas.push({ minX: -30, maxX: 30, minZ: -20, maxZ: 30 });

  // Placeholder props (the names do not exist on purpose, to show the fallback).
  const rnd = new Random('greybox');
  const place = async (image: string, count: number, height: number, collider: number): Promise<void> => {
    const img = await assets.acquire(image);
    const list: CardInstance[] = [];
    for (let i = 0; i < count; i++) {
      const x = rnd.range(-28, 28);
      const z = rnd.range(-15, 40);
      if (Math.hypot(x, z) < 5 || Math.hypot(x, z - 9) < 5 || Math.hypot(x - 9, z - 16) < 5) continue;
      list.push({ x, z, height, rotY: 0, mirror: false, tint: [1, 1, 1], shadow: height * 0.5 });
      if (collider > 0) walk.colliders.push({ x, z, r: collider });
    }
    new PaperCardSet(scene, image, img, list);
  };
  await place('greybox/tree', 18, 4, 0.5);
  await place('greybox/rock', 10, 1.4, 0.6);
  fogs.add({ id: 'test_worthy', x: 0, z: 9, text: "I'm not worthy", release: 'I am worthy', points: 10 });
  fogs.add({ id: 'test_angry', x: 9, z: 16, text: "I'm so angry", release: 'I choose peace', points: 10 });
  companion.addHint({ id: 'test_worthy', x: 0, z: 9, line: 'hint', blockade: true });
  companion.addHint({ id: 'test_angry', x: 9, z: 16, line: 'hint', blockade: true });
  companion.addHint({ id: 'hint_tree', x: -12, z: 4, line: 'hintOak' });
}
