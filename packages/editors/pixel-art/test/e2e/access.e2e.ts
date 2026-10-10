// Import Third-party Dependencies
import {
  changeRole,
  grantRole,
  type RoleGrant
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { test as base, expect } from "./fixtures.ts";

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

test("a role change applies live: view only for a spectator, editing again once promoted", async({
  panel,
  context,
  baseURL,
  grant
}) => {
  const { modes, colors } = panel;
  await modes.select("fill");
  await expect(panel.accessBadge).toHaveCount(0);

  await changeRole(context, baseURL!, {
    ...grant,
    role: "spectator"
  });

  await expect(panel.accessBadge).toHaveText("View only");
  for (const mode of ["paint", "erase", "fill"] as const) {
    await expect(modes.button(mode)).toBeDisabled();
  }
  await expect(modes.button("uv")).toHaveCount(0);
  await expect(panel.importButton).toBeDisabled();
  await expect(panel.clearButton).toBeDisabled();
  expect(await modes.active()).toBe("move");

  await colors.dockToggle.click();
  const slot = colors.slot(1);
  await slot.dblclick();
  await expect(slot).not.toHaveAttribute("aria-haspopup");
  await expect(panel.root.getByRole("dialog", { name: "Edit palette color" })).toHaveCount(0);

  await changeRole(context, baseURL!, grant);

  await expect(panel.accessBadge).toHaveCount(0);
  await expect(modes.button("paint")).toBeEnabled();
  await expect(modes.button("uv")).toBeVisible();
  await expect.poll(() => modes.active()).toBe("fill");
});
