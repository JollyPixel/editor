// Import Third-party Dependencies
import {
  changeRole,
  grantRole,
  type RoleGrant
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { test as base, expect } from "./fixtures.ts";

// CONSTANTS
const kCell = { x: 0, y: 0, z: 0 };

const test = base.extend<{ grant: RoleGrant; }>({
  grant: [
    {
      role: "member",
      subject: "voxel-map-access-e2e"
    },
    { option: true }
  ],
  context: async({ context, baseURL, grant }, use) => {
    await grantRole(context, baseURL!, grant);
    await use(context);
  }
});

test("a role change applies live: view only for a spectator, editing again once promoted", async({
  map,
  context,
  baseURL,
  grant
}) => {
  const { viewport, world, toolbar, layers, templates, texture } = map;
  await viewport.pinCamera();
  await map.brush.change({ blockId: 3 });
  await map.panes.open("Layers");
  await expect(layers.addButton).toBeEnabled();

  await changeRole(context, baseURL!, {
    ...grant,
    role: "spectator"
  });

  await expect(toolbar.status).toContainText("View only");
  await expect(layers.addButton).toBeDisabled();
  await expect(templates.saveButton).toBeDisabled();
  await viewport.click(kCell);
  expect(await world.blocks([kCell])).toEqual([null]);

  await map.panes.open("Blocks");
  await expect(texture.accessBadge).toHaveText("View only");

  await changeRole(context, baseURL!, grant);

  await expect(toolbar.status).toBeHidden();
  await expect(texture.accessBadge).toHaveCount(0);
  await viewport.click(kCell);
  await expect.poll(() => world.blocks([kCell])).toEqual([3]);
  await map.panes.open("Layers");
  await expect(layers.addButton).toBeEnabled();
});
