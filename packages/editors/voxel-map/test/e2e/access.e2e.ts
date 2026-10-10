// Import Third-party Dependencies
import {
  changeRole,
  grantRole,
  type RoleGrant
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { test as base, expect } from "./fixtures.ts";
import { setBrush } from "./support/brush.ts";
import { openPane } from "./support/panels.ts";
import {
  blocksAt,
  clickCell,
  pinCamera
} from "./support/scene.ts";
import { texturePanel } from "./support/texture.ts";

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
  page,
  context,
  baseURL,
  grant
}) => {
  await pinCamera(page);
  await setBrush(page, { blockId: 3 });
  const notice = page.locator("voxel-edit-toolbar").getByRole("status");
  const layers = page.locator("layer-manager");
  const addLayer = layers.getByRole("button", { name: "Add layer" });
  const saveTemplate = page.getByRole("button", { name: "Save layer as template" });
  await openPane(page, "Layers");
  await expect(addLayer).toBeEnabled();

  await changeRole(context, baseURL!, {
    ...grant,
    role: "spectator"
  });

  await expect(notice).toContainText("View only");
  await expect(addLayer).toBeDisabled();
  await expect(saveTemplate).toBeDisabled();
  await clickCell(page, kCell);
  expect(await blocksAt(page, [kCell])).toEqual([null]);

  await openPane(page, "Blocks");
  await expect(texturePanel(page).locator("[part=access-badge]")).toHaveText("View only");

  await changeRole(context, baseURL!, grant);

  await expect(notice).toBeHidden();
  await expect(texturePanel(page).locator("[part=access-badge]")).toHaveCount(0);
  await clickCell(page, kCell);
  await expect.poll(() => blocksAt(page, [kCell])).toEqual([3]);
  await openPane(page, "Layers");
  await expect(addLayer).toBeEnabled();
});
