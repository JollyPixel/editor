// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import type { SelectionProgressEvent } from "#src/tools/SelectController.events.ts";
import { makeContainer } from "./helpers/dom.ts";
import { mouseEvent } from "./helpers/events.ts";
import {
  paintHorizontalPair,
  selectHorizontalPair
} from "./helpers/select.ts";

/**
 * Coverage for the `selection-progress` / `selection-committed` /
 * `selection-idle` events `SelectController` emits (consumed by
 * `SelectionGhostSync`) — see PixelArtCanvas.select.spec.ts for the default
 * rectangle-drag/move behavior these build on.
 */
describe("PixelArtCanvas — select ghost events", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    ({ container } = makeContainer());
  });

  // Same 200x200/8x8/zoom-4 setup as PixelArtCanvas.select.spec.ts: client
  // 84 + n*4 -> texture n.
  function makeManager(
    options: PixelArtCanvasOptions = {}
  ): PixelArtCanvas {
    return new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      zoom: { default: 4 },
      ...options
    });
  }

  function recordEvents(
    manager: PixelArtCanvas
  ): {
    progress: SelectionProgressEvent[];
    counts: { committed: number; idle: number; };
  } {
    const progress: SelectionProgressEvent[] = [];
    const counts = { committed: 0, idle: 0 };

    manager.selectionEvents.on("selection-progress", (event) => progress.push(event));
    manager.selectionEvents.on("selection-committed", () => {
      counts.committed++;
    });
    manager.selectionEvents.on("selection-idle", () => {
      counts.idle++;
    });

    return { progress, counts };
  }

  describe("creating a new selection", () => {
    test("streams growing creating-phase rects while dragging a new marquee", () => {
      const manager = makeManager();
      const canvas = manager.canvas();
      manager.mode = "select";
      const events = recordEvents(manager);

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));

      assert.ok(events.progress.length >= 1);
      const last = events.progress.at(-1)!;
      assert.strictEqual(last.phase, "creating");
      assert.deepStrictEqual(
        (last as { rect: unknown; }).rect,
        { x: 2, y: 2, width: 2, height: 2 }
      );
      assert.strictEqual(events.counts.idle, 0, "not finished yet");
    });

    test("finishing a valid new selection emits selection-idle exactly once, never selection-committed", () => {
      const manager = makeManager();
      const canvas = manager.canvas();
      manager.mode = "select";
      const events = recordEvents(manager);

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.counts.idle, 1);
      assert.strictEqual(events.counts.committed, 0);
    });

    test("a degenerate (1x1) marquee still emits selection-idle on mouseup", () => {
      const manager = makeManager();
      const canvas = manager.canvas();
      manager.mode = "select";
      const events = recordEvents(manager);

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.counts.idle, 1);
    });
  });

  describe("shape-select (magic wand)", () => {
    test("resolves instantly on click: no progress event, a single selection-idle", () => {
      const manager = makeManager();
      const canvas = manager.canvas();
      manager.mode = "select";
      manager.tools.select.shape = true;
      const events = recordEvents(manager);

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.progress.length, 0, "no live drag phase for shape-select");
      assert.strictEqual(events.counts.idle, 1);
      assert.strictEqual(events.counts.committed, 0);
    });
  });

  describe("moving an existing selection", () => {
    function selectPair(
      manager: PixelArtCanvas
    ): void {
      paintHorizontalPair(manager);
      manager.mode = "select";
      selectHorizontalPair(manager.canvas());
    }

    test("streams moving-phase progress with sourceRect/liveRect/mask/blankSource while dragging", () => {
      const manager = makeManager();
      selectPair(manager);
      const events = recordEvents(manager);
      const canvas = manager.canvas();

      // The selection sits over (2,2)-(3,2); grab inside it and drag it.
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 92, 100));

      const moving = events.progress.filter((event) => event.phase === "moving");
      assert.ok(moving.length >= 1);
      const last = moving.at(-1) as Extract<SelectionProgressEvent, { phase: "moving"; }>;
      assert.deepStrictEqual(last.sourceRect, { x: 2, y: 2, width: 2, height: 1 });
      assert.deepStrictEqual(last.liveRect, { x: 2, y: 4, width: 2, height: 1 });
      assert.deepStrictEqual(last.mask, [true, true]);
      assert.strictEqual(last.blankSource, true);
    });

    test("a real move commits: selection-committed fires, selection-idle does not", () => {
      const manager = makeManager();
      selectPair(manager);
      const events = recordEvents(manager);
      const canvas = manager.canvas();

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 92, 100));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.counts.committed, 1);
      assert.strictEqual(events.counts.idle, 0);
    });

    test("dropping a selection back on its own source (no-op move) emits selection-idle instead", () => {
      const manager = makeManager();
      selectPair(manager);
      const events = recordEvents(manager);
      const canvas = manager.canvas();

      // Grab the selection and release without moving it.
      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(events.counts.committed, 0);
      assert.strictEqual(events.counts.idle, 1);
    });
  });

  describe("interrupting a gesture", () => {
    test("clear() mid-creation emits selection-idle", () => {
      const manager = makeManager();
      const canvas = manager.canvas();
      manager.mode = "select";
      const events = recordEvents(manager);

      canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
      canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
      assert.strictEqual(events.counts.idle, 0, "sanity: nothing cleared it yet");

      // Directly exercised through the public clear-on-mode-switch surface:
      // toggling shape mode while a gesture is active clears it.
      manager.tools.select.shape = true;

      assert.strictEqual(events.counts.idle, 1);
    });
  });
});
