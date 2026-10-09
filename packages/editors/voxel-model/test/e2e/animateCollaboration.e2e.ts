// Import Third-party Dependencies
import {
  dialog,
  treeRow
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  animatePanel,
  clipRow,
  openAnimateTab,
  playhead,
  scrubTo,
  startClip,
  timeline
} from "./support/animate.ts";

test("a peer's open clip shows a chip, and their playhead a marker to jump to", async({ page, peer }) => {
  test.slow();
  await startClip(page);
  await openAnimateTab(peer);
  await treeRow(peer, "Clip 1").click();

  await expect(clipRow(page, "Clip 1").getByTitle("Peer")).toBeVisible();

  await scrubTo(peer, 0.5);
  const marker = timeline(page).getByRole("button", { name: "Jump to Peer" });
  await expect(marker).toBeVisible();
  await expect(playhead(page)).toContainText("Frame 0 / 24");
  await marker.click();
  await expect(playhead(page)).toContainText("Frame 12 / 24");

  await peer.getByRole("tab", { name: "Build" }).click();
  await expect(clipRow(page, "Clip 1").getByTitle("Peer")).toBeHidden();
  await expect(marker).toBeHidden();
});

test("a peer deleting my open clip moves me to its set and says who did it", async({ page, peer }) => {
  test.slow();
  await startClip(page);
  await openAnimateTab(peer);
  await clipRow(peer, "Clip 1").click({ button: "right" });
  await peer.getByRole("menu", { name: "Animation actions" })
    .getByRole("menuitem", { name: "Delete", exact: true })
    .click();
  await dialog(peer, "Delete Clip").getByRole("button", { name: "Delete" }).click();

  await expect(treeRow(page, "Clip 1")).toHaveCount(0);
  await expect(animatePanel(page).getByRole("status"))
    .toHaveText("Peer deleted the clip you had open.");
});
