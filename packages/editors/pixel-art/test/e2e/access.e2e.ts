// Import Third-party Dependencies
import type { Locator } from "@playwright/test";
import {
  changeRole,
  grantRole,
  type RoleGrant
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { test as base, expect } from "./fixtures.ts";
import {
  activeMode,
  setMode
} from "./utils.ts";

const test = base.extend<{ grant: RoleGrant; }>({
  grant: [
    {
      role: "member",
      subject: "pixel-art-access-e2e"
    },
    { option: true }
  ],
  context: async({ context, baseURL, grant }, use) => {
    await grantRole(context, baseURL!, grant);
    await use(context);
  }
});

function modeButton(
  panel: Locator,
  name: string
): Locator {
  return panel.getByRole("button", {
    name,
    exact: true
  });
}

test("a role change applies live: view only for a spectator, editing again once promoted", async({
  panel,
  context,
  baseURL,
  grant
}) => {
  const badge = panel.locator("[part=access-badge]");
  await setMode(panel, "fill");
  await expect(badge).toHaveCount(0);

  await changeRole(context, baseURL!, {
    ...grant,
    role: "spectator"
  });

  await expect(badge).toHaveText("View only");
  for (const name of ["Paint", "Erase", "Fill"]) {
    await expect(modeButton(panel, name)).toBeDisabled();
  }
  await expect(modeButton(panel, "UV")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Import texture" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Clear texture" })).toBeDisabled();
  expect(await activeMode(panel)).toBe("move");

  await panel.getByRole("button", { name: "Docked color picker" }).click();
  const slot = panel.locator("color-palette-grid")
    .getByRole("button", { name: "Palette color 1", exact: true });
  await slot.dblclick();
  await expect(slot).not.toHaveAttribute("aria-haspopup");
  await expect(panel.getByRole("dialog", { name: "Edit palette color" })).toHaveCount(0);

  await changeRole(context, baseURL!, grant);

  await expect(badge).toHaveCount(0);
  await expect(modeButton(panel, "Paint")).toBeEnabled();
  await expect(modeButton(panel, "UV")).toBeVisible();
  await expect.poll(() => activeMode(panel)).toBe("fill");
});
