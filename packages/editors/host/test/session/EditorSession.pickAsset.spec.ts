// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import type { Dialog } from "@jolly-pixel/ui/elements/dialog";
import type { Tree } from "@jolly-pixel/ui/elements/tree";
import type { Button } from "@jolly-pixel/ui/elements/button";

// Import Internal Dependencies
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { EditorSession } from "#src/session/EditorSession.ts";
import type { AssetPickOptions } from "#src/session/picker/pickAsset.ts";
import {
  fakeConnection,
  GRASS,
  STONE
} from "../helpers/session/connection.ts";

// CONSTANTS
const kPixelArt = {
  kind: "pixelart",
  label: "Pixel art",
  extension: ".pixelart"
};

async function openSession(): Promise<EditorSession> {
  const { connection } = await fakeConnection();

  return connection.openSession({
    launch: new EditorLaunch(new AssetId("map")),
    kinds: [],
    accepts: "voxelmap"
  });
}

async function openPicker(
  t: TestContext,
  session: EditorSession,
  options: Partial<AssetPickOptions> = {}
) {
  const picked = session.pickAsset({
    kinds: [kPixelArt],
    title: "Pick a texture",
    ...options
  });
  const dialog = await t.waitFor(() => {
    const element = document.querySelector<Dialog>("jolly-dialog");
    assert.ok(element?.open);

    return element;
  });
  const tree = dialog.querySelector<Tree>("jolly-tree")!;
  const [cancel, pick] = dialog.querySelectorAll<Button>("jolly-button");

  return {
    picked,
    tree,
    cancel,
    pick
  };
}

function treeEvent(
  type: "jolly-select" | "jolly-activate",
  detail: object
): CustomEvent {
  return new CustomEvent(type, {
    detail
  });
}

describe("EditorSession.pickAsset", () => {
  test("keeps Pick disabled until an asset is selected, then resolves it", async(t) => {
    const session = await openSession();
    const { picked, tree, pick } = await openPicker(t, session);

    assert.deepEqual(
      tree.nodes.map((node) => node.label),
      ["grass", "stone"]
    );
    assert.equal(pick.disabled, true);

    tree.dispatchEvent(treeEvent("jolly-select", {
      selected: ["asset:stone"]
    }));
    assert.equal(pick.disabled, false);
    pick.click();

    assert.deepEqual(await picked, {
      id: STONE.id,
      kind: STONE.kind
    });
    session.dispose();
  });

  test("picks an asset row on activation", async(t) => {
    const session = await openSession();
    const { picked, tree } = await openPicker(t, session);

    tree.dispatchEvent(treeEvent("jolly-activate", {
      id: "asset:grass"
    }));

    assert.deepEqual(await picked, {
      id: GRASS.id,
      kind: GRASS.kind
    });
    session.dispose();
  });

  test("resolves null on Cancel even with a current asset", async(t) => {
    const session = await openSession();
    const { picked, cancel, pick } = await openPicker(t, session, {
      current: {
        id: GRASS.id,
        kind: GRASS.kind
      }
    });

    assert.equal(pick.disabled, false);
    cancel.click();

    assert.equal(await picked, null);
    session.dispose();
  });

  test("closes an open picker with null when the session is disposed", async(t) => {
    const session = await openSession();
    const { picked } = await openPicker(t, session);

    session.dispose();

    assert.equal(await picked, null);
  });

  test("rejects on a disposed session", async() => {
    const session = await openSession();
    session.dispose();

    await assert.rejects(session.pickAsset({
      kinds: [kPixelArt],
      title: "Pick a texture"
    }), /disposed/);
    assert.equal(document.querySelector("jolly-dialog"), null);
  });
});
