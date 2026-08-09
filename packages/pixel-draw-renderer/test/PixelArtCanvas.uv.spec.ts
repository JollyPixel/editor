// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  mouseEvent,
  deleteKey
} from "./helpers/events.ts";

describe("PixelArtCanvas — uv mode", () => {
  // 200x200 container, 8x8 texture, zoom 4 -> centered camera (84, 84).
  // client 84 + n*4 -> texture n.

  function makeManager(
    options: PixelArtCanvasOptions = {}
  ): PixelArtCanvas {
    return createPixelArtCanvas({
      zoom: { default: 4 },
      history: { enabled: true },
      ...options
    }).manager;
  }

  test("uv.create() places a region and it is not visible by default", () => {
    const manager = makeManager();
    const region = manager.uv.create({
      width: 4,
      height: 4
    });

    assert.strictEqual(
      [...manager.uv.regions].length,
      1
    );
    assert.ok(!manager.uv.isVisible(region.id));
  });

  test("selecting a region makes it draggable in uv mode", () => {
    const manager = makeManager();
    manager.mode = "uv";
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.uv.select(region.id);

    const canvas = manager.canvas();
    canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
    canvas.dispatchEvent(mouseEvent("mousemove", 92, 92));
    canvas.dispatchEvent(mouseEvent("mouseup", 92, 92));

    assert.deepStrictEqual(
      manager.uv.get(region.id)!.rectFor("front"),
      { x: 2, y: 2, width: 4, height: 4 }
    );
  });

  test("Delete removes the selected region while in uv mode", () => {
    const manager = makeManager();
    manager.mode = "uv";
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.uv.select(region.id);

    // Keyboard shortcuts only dispatch while the canvas is hovered.
    manager.canvas().dispatchEvent(
      mouseEvent("mouseenter", 84, 84)
    );
    globalThis.window.dispatchEvent(deleteKey());

    assert.strictEqual(
      manager.uv.get(region.id),
      undefined
    );
  });

  test("Delete in select mode does not delete a UV region selected earlier (regression)", () => {
    const manager = makeManager();

    // Select a UV region from outside uv mode (e.g. a consumer's own
    // 3D-scene click), then switch to select mode without ever entering
    // uv mode. Selection persists across mode changes by design (see
    // uv/UVMap.md), so it must NOT be treated as "the active uv delete
    // target" once in a different mode.
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.uv.select(region.id);

    manager.mode = "select";
    const canvas = manager.canvas();
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    globalThis.window.dispatchEvent(deleteKey());

    assert.ok(
      manager.canUndo(),
      "the select-mode delete should have committed an edit"
    );
    assert.ok(
      manager.uv.get(region.id),
      "the UV region must survive a Delete outside uv mode"
    );
  });

  test("leaving uv mode cancels an in-progress drag without moving the region", () => {
    const manager = makeManager();
    manager.mode = "uv";
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.uv.select(region.id);

    const canvas = manager.canvas();
    canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
    canvas.dispatchEvent(mouseEvent("mousemove", 92, 92));
    manager.mode = "paint";
    canvas.dispatchEvent(mouseEvent("mouseup", 92, 92));

    assert.deepStrictEqual(
      manager.uv.get(region.id)!.rectFor("front"),
      region.rectFor("front")
    );
  });

  test("leaving uv mode does not clear the current selection/visibility", () => {
    const manager = makeManager();
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.mode = "uv";
    manager.uv.select(region.id);

    manager.mode = "paint";

    assert.strictEqual(
      manager.uv.selectedRegionId,
      region.id
    );
    assert.ok(manager.uv.isVisible(region.id));
  });

  describe("cursor", () => {
    test("entering uv mode sets a grab cursor; leaving it resets to default", () => {
      const manager = makeManager();
      const canvas = manager.canvas();

      manager.mode = "uv";
      assert.strictEqual(canvas.style.cursor, "grab");

      manager.mode = "paint";
      assert.strictEqual(canvas.style.cursor, "");
    });

    test("dragging a region switches the cursor to grabbing, and back to grab on release", () => {
      const manager = makeManager();
      manager.mode = "uv";
      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.select(region.id);

      const canvas = manager.canvas();
      canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
      assert.strictEqual(canvas.style.cursor, "grabbing");

      canvas.dispatchEvent(mouseEvent("mouseup", 92, 92));
      assert.strictEqual(canvas.style.cursor, "grab");
    });

    test("clicking empty space (no drag started) keeps the idle grab cursor", () => {
      const manager = makeManager();
      manager.mode = "uv";

      const canvas = manager.canvas();
      canvas.dispatchEvent(
        mouseEvent("mousedown", 10, 10)
      );

      assert.strictEqual(canvas.style.cursor, "grab");
    });
  });

  describe("history", () => {
    test("undo/redo a create", () => {
      const manager = makeManager();
      const region = manager.uv.create({
        width: 4,
        height: 4
      });

      assert.ok(manager.canUndo());
      manager.undo();
      assert.strictEqual(
        manager.uv.get(region.id),
        undefined
      );

      manager.redo();
      assert.deepStrictEqual(
        manager.uv.get(region.id),
        region
      );
    });

    test("undo/redo a delete", () => {
      const manager = makeManager();
      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.delete(region.id);

      manager.undo();
      assert.deepStrictEqual(
        manager.uv.get(region.id),
        region
      );

      manager.redo();
      assert.strictEqual(
        manager.uv.get(region.id),
        undefined
      );
    });

    test("undo/redo a move", () => {
      const manager = makeManager();
      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.move(
        region.id,
        { x: 3, y: 3, width: 4, height: 4 }
      );

      manager.undo();
      assert.deepStrictEqual(
        manager.uv.get(region.id)!.rectFor("front"),
        region.rectFor("front")
      );

      manager.redo();
      assert.deepStrictEqual(
        manager.uv.get(region.id)!.rectFor("front"),
        { x: 3, y: 3, width: 4, height: 4 }
      );
    });

    test("undo/redo an uncollapse", () => {
      const manager = makeManager();
      const region = manager.uv.create({ width: 4, height: 4 });
      manager.uv.uncollapse(region.id);

      manager.undo();
      assert.strictEqual(manager.uv.get(region.id)!.state, "collapsed");

      manager.redo();
      assert.strictEqual(manager.uv.get(region.id)!.state, "uncollapsed");
    });

    test("undoing a collapse restores the previous face layout", () => {
      const manager = makeManager();
      const region = manager.uv.create({ width: 4, height: 4 });
      manager.uv.uncollapse(region.id);
      manager.uv.move(region.id, { x: 3, y: 3, width: 4, height: 4 }, "top");
      manager.uv.collapse(region.id);
      assert.strictEqual(manager.uv.get(region.id)!.state, "collapsed");

      manager.undo();

      const restored = manager.uv.get(region.id)!;
      assert.strictEqual(restored.state, "uncollapsed");
      assert.deepStrictEqual(
        restored.rectFor("top"),
        { x: 3, y: 3, width: 4, height: 4 },
        "collapse is lossy, so undo must replay the whole previous region"
      );
    });

    test("undoing a collapse does not look like a region being recreated", () => {
      const manager = makeManager();
      const region = manager.uv.create({ width: 4, height: 4 });
      manager.uv.uncollapse(region.id);
      manager.uv.collapse(region.id);

      const created: string[] = [];
      const deleted: string[] = [];
      manager.uv.on("region-created", (e) => created.push(e.region.id));
      manager.uv.on("region-deleted", (e) => deleted.push(e.region.id));

      manager.undo();

      assert.deepStrictEqual(created, [], "a consumer would spawn a duplicate mesh");
      assert.deepStrictEqual(deleted, []);
    });

    test("undoing a create does not push a new entry (undo stack stays empty after)", () => {
      const manager = makeManager();
      manager.uv.create({
        width: 4,
        height: 4
      });

      manager.undo();
      assert.ok(!manager.canUndo());
      assert.ok(manager.canRedo());
    });
  });

  describe("network hook", () => {
    test("create/move/delete each emit exactly one hook event of the matching action", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = makeManager({
        onBufferUpdated: (e) => events.push(e)
      });

      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.move(
        region.id,
        { x: 1, y: 1, width: 4, height: 4 }
      );
      manager.uv.delete(region.id);

      assert.deepStrictEqual(events.map((e) => e.action), [
        "uv-region-created",
        "uv-region-moved",
        "uv-region-deleted"
      ]);
    });

    test("undo of a move broadcasts the inverse uv-region-moved event", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = makeManager({
        onBufferUpdated: (e) => events.push(e)
      });

      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.move(
        region.id,
        { x: 5, y: 5, width: 4, height: 4 }
      );
      events.length = 0;

      manager.undo();

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "uv-region-moved");
      if (events[0].action === "uv-region-moved") {
        assert.deepStrictEqual(
          events[0].metadata.rect,
          region.rectFor("front")
        );
      }
    });

    test("applyRemoteCommand restores a remote region without re-broadcasting or recording history", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = makeManager({
        onBufferUpdated: (e) => events.push(e)
      });

      manager.applyRemoteCommand({
        action: "uv-region-created",
        metadata: {
          region: {
            id: "remote-1",
            rect: { x: 0, y: 0, width: 4, height: 4 },
            color: "#f00"
          }
        }
      });

      assert.ok(manager.uv.get("remote-1"));
      assert.strictEqual(events.length, 0, "remote application must not re-broadcast");
      assert.ok(!manager.canUndo(), "remote application must not record local history");
    });
  });

  describe("snapshot", () => {
    test("loadSnapshot restores uv regions from a remote snapshot", () => {
      const manager = makeManager();
      manager.uv.create({
        width: 4,
        height: 4
      });

      const remoteRegion = {
        id: "remote-1",
        rect: { x: 1, y: 1, width: 2, height: 2 },
        color: "#00f"
      };
      manager.loadSnapshot(
        { x: 8, y: 8 },
        new Uint8ClampedArray(8 * 8 * 4),
        [remoteRegion]
      );

      assert.strictEqual([...manager.uv.regions].length, 1);
      assert.deepStrictEqual(
        manager.uv.get("remote-1")!.toJSON(),
        { ...remoteRegion, state: "collapsed" }
      );
    });
  });
});

describe("PixelArtCanvas — onResize (SVG overlay refresh, regression)", () => {
  // resizeCanvas() shifts the camera to keep content centered, so every
  // overlay computed from the old camera position must redraw itself
  // against the new one — same as after a pan/zoom. onResize() previously
  // resized the SVG element itself but never told the overlays to redraw.

  function makeResizableContainer(): {
    container: HTMLDivElement;
    children: Element[];
    setSize: (width: number, height: number) => void;
  } {
    let width = 200;
    let height = 200;
    const container = document.createElement("div");
    const children: Element[] = [];
    Object.assign(container, {
      style: {},
      getBoundingClientRect: () => {
        return {
          left: 0,
          top: 0,
          right: width,
          bottom: height,
          width,
          height
        };
      },
      appendChild: (child: Element) => {
        children.push(child);

        return child;
      }
    });

    return {
      container,
      children,
      setSize: (w, h) => {
        width = w;
        height = h;
      }
    };
  }

  test("the UV overlay follows the camera shift caused by a container resize", () => {
    const {
      container,
      children,
      setSize
    } = makeResizableContainer();
    const manager = new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      zoom: { default: 4 }
    });

    // First cascade position -> rect {x:0,y:0,...}. 200x200 container, zoom
    // 4 -> centered camera (84, 84), so the overlay starts at screen (84, 84).
    manager.uv.create({ width: 4, height: 4 });
    manager.uv.showAll = true;

    // Each UV entry is a <g> of two rects: the inset casing, then the colored
    // border on the region's own bounds — the one to measure. Every other
    // overlay group — brush highlight, peer cursors — carries a "visibility"
    // attribute, which UVOverlay never sets.
    const svg = children.find(
      (c) => !("getContext" in c)
    ) as SVGElement;
    const rect = svg.querySelector("g:not([visibility]) > rect:last-child")!;
    assert.strictEqual(rect.getAttribute("x"), "84");
    assert.strictEqual(rect.getAttribute("y"), "84");

    // Grow the container -> camera shifts by half the size delta (see
    // Viewport.resizeCanvas): (300-200)/2 = 50 -> new camera (134, 134).
    setSize(300, 300);
    manager.onResize();

    assert.strictEqual(
      rect.getAttribute("x"),
      "134",
      "the overlay must follow the camera shift from resizeCanvas"
    );
    assert.strictEqual(
      rect.getAttribute("y"),
      "134",
      "the overlay must follow the camera shift from resizeCanvas"
    );
    manager.destroy();
  });

  test("the select overlay follows the camera shift caused by a container resize", () => {
    const { container, children, setSize } = makeResizableContainer();
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      zoom: { default: 4 }
    });

    manager.mode = "select";
    const canvas = children[0];
    canvas.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 92,
        clientY: 92,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        buttons: 1,
        clientX: 96,
        clientY: 96,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true
      })
    );

    // Direct children only, excluding BrushHighlightOverlay's nested rects;
    // the selection outline is the direct rect explicitly marked visible.
    const svg = children.find((c) => !("getContext" in c)) as SVGElement;
    const rect = [...svg.querySelectorAll(":scope > rect")]
      .find((el) => el.getAttribute("visibility") === "visible")!;
    // (2,2) texture -> screen (92, 92) at camera (84, 84).
    assert.strictEqual(rect.getAttribute("x"), "92");

    setSize(300, 300);
    manager.onResize();

    // Camera shifts to (134, 134) -> screen (2*4 + 134) = 142.
    assert.strictEqual(
      rect.getAttribute("x"),
      "142",
      "the selection outline must follow the camera shift from resizeCanvas"
    );
    manager.destroy();
  });
});
