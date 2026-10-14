// Import Third-party Dependencies
import {
  CommandConsole,
  dialog,
  recordSockets
} from "@jolly-pixel/e2e";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  offlineTest as test,
  expect
} from "./fixtures.ts";
import { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kHostCell = {
  x: 0,
  y: 0,
  z: 0
};
const kGuestCell = {
  x: 1,
  y: 0,
  z: 0
};

function targetOf(
  editor: VoxelMapPage
): Promise<string> {
  return editor.page.evaluate(
    () => window.voxelMapEditor!.session.target.record.id
  );
}

test("a guest joins from a peer invite, edits with the host and sees it leave", async({ map, page }) => {
  test.slow();
  await map.openOffline();
  const commands = new CommandConsole(page);
  await commands.submit("/peer.invite");
  const invite = await commands.log.getByText("#peer=").last().textContent();
  await commands.close();

  const guest = new VoxelMapPage(await page.context().newPage());
  const sockets = recordSockets(guest.page);
  try {
    await guest.page.goto(invite!.trim());
    await waitForEditor(guest.page);
    expect(await targetOf(guest)).toBe(await targetOf(map));

    await map.world.seed([{ ...kHostCell, blockId: 1 }]);
    await expect.poll(() => guest.world.blocks([kHostCell])).toEqual([1]);
    await guest.world.seed([{ ...kGuestCell, blockId: 1 }]);
    await expect.poll(() => map.world.blocks([kGuestCell])).toEqual([1]);
    expect(sockets).toEqual([]);

    await page.close();
    await expect(
      dialog(guest.page, "Session ended").getByRole("button", { name: "Reload" })
    ).toBeVisible();
  }
  finally {
    await guest.page.close();
  }
});
