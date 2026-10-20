// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";

// CONSTANTS
const kCell = { x: 0, y: 0, z: 0 };

test("a role change applies live: view only for a spectator, editing again once promoted", async({
  map,
  access
}) => {
  const { viewport, world, toolbar, layers, texture } = map;
  await viewport.pinCamera();
  await map.brush.change({ blockId: 3 });
  await map.panes.open("Layers");
  await expect(layers.addButton).toBeEnabled();

  await access.become("spectator");

  await expect(toolbar.status).toContainText("View only");
  await expect(layers.addButton).toBeDisabled();
  await viewport.click(kCell);
  expect(await world.blocks([kCell])).toEqual([null]);

  await map.panes.open("Blocks");
  await expect(texture.accessBadge).toHaveText("View only");

  await access.become("member");

  await expect(toolbar.status).toBeHidden();
  await expect(texture.accessBadge).toHaveCount(0);
  await viewport.click(kCell);
  await expect.poll(() => world.blocks([kCell])).toEqual([3]);
  await map.panes.open("Layers");
  await expect(layers.addButton).toBeEnabled();
});
