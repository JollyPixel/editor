// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { composeBlockId } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { setupMapBlocksets } from "../../helpers/mapBlocksets.ts";
import { FakeFrames } from "../../helpers/frames.ts";

describe("MapBlocksets alpha modes", () => {
  it("writes a block with the alpha mode its pixels need in a single command", async() => {
    const { view, sources, blocksets } = setupMapBlocksets();
    const opened = sources.opened.get("terrain")!;
    const id = composeBlockId(1, 1);
    await opened.ready;

    const actions: string[] = [];
    opened.blockset.on("command", (command) => actions.push(command.action));
    sources.transparent = true;
    blocksets.defineBlock({
      ...view.document.blocks.get(id)!,
      name: "leaves"
    });

    assert.deepEqual(actions, ["block-defined"]);
    assert.equal(opened.blockset.blocks.get(1)?.alphaMode, "mask");
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");
  });

  it("keeps the alpha mode of a block written before its blockset loaded", () => {
    const { view, sources, blocksets } = setupMapBlocksets();
    const id = composeBlockId(1, 1);
    sources.transparent = true;

    blocksets.defineBlock({
      ...view.document.blocks.get(id)!,
      name: "leaves"
    });

    assert.equal(view.document.blocks.get(id)?.alphaMode, undefined);
  });

  it("syncs the alpha mode of the blocks a blockset repaint changed", async() => {
    const { view, sources, blocksets } = setupMapBlocksets();
    const id = composeBlockId(1, 1);
    await sources.opened.get("terrain")!.ready;

    sources.transparent = true;
    blocksets.syncAlphaModes("terrain");
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");

    sources.transparent = false;
    blocksets.syncAlphaModes("terrain", { x: 32, y: 32, width: 4, height: 4 });
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");

    blocksets.syncAlphaModes("terrain", { x: 0, y: 0, width: 4, height: 4 });
    assert.equal(view.document.blocks.get(id)?.alphaMode, "opaque");
  });

  it("syncs the alpha modes a pixel burst changed once the burst settles", async(t) => {
    const frames = new FakeFrames(t);
    const { view, sources } = setupMapBlocksets();
    const id = composeBlockId(1, 1);
    await sources.opened.get("terrain")!.ready;

    sources.transparent = true;
    sources.pixels.get("terrain")!.emit("changed", {
      bounds: { x: 0, y: 0, width: 4, height: 4 }
    });
    frames.run();
    assert.notEqual(view.document.blocks.get(id)?.alphaMode, "mask");

    frames.run();
    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");
  });

  it("announces a loaded blockset once its alpha modes are synced", async() => {
    const { view, sources, blocksets } = setupMapBlocksets();
    const id = composeBlockId(1, 1);
    const seen: Array<string | undefined> = [];
    sources.transparent = true;
    blocksets.on("change", () => {
      seen.push(view.document.blocks.get(id)?.alphaMode);
    });

    await sources.opened.get("terrain")!.ready;

    assert.deepEqual(seen, ["mask"]);
  });

  it("resyncs the alpha modes of its blocksets on a map reset", async() => {
    const { view, sources, editorMap } = setupMapBlocksets();
    const id = composeBlockId(1, 1);
    await sources.opened.get("terrain")!.ready;

    sources.transparent = true;
    editorMap.emit("reset");

    assert.equal(view.document.blocks.get(id)?.alphaMode, "mask");
  });

  it("syncs no alpha mode while the map is loading", async() => {
    const { view, sources, editorMap } = setupMapBlocksets();
    const id = composeBlockId(1, 1);
    editorMap.ready = false;
    sources.transparent = true;

    await sources.opened.get("terrain")!.ready;
    editorMap.emit("reset");

    assert.notEqual(view.document.blocks.get(id)?.alphaMode, "mask");
  });
});
