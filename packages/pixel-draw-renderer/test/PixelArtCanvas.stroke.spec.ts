// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LocalHistory } from "./helpers/history/LocalHistory.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import type { PeerStrokePixel } from "#src/types.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  mouseEvent,
  moveTo
} from "./helpers/events.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kGreen = {
  r: 0,
  g: 255,
  b: 0,
  a: 255
};
const kBlueBytes = [0, 0, 255, 255];
const kRedBytes = [255, 0, 0, 255];

function makeCanvas() {
  const commands: PixelCommand[] = [];
  const progress: PeerStrokePixel[][] = [];
  const { manager, canvas } = createPixelArtCanvas({
    texture: {
      size: { x: 16, y: 16 },
      defaultColor: "#0000FF"
    },
    zoom: { default: 4 },
    history: new LocalHistory(),
    brush: {
      size: 1,
      maxSize: 1,
      color: "#FF0000",
      secondaryColor: "#00FF00"
    },
    onCommand: (command) => commands.push(command)
  });
  manager.onStrokeProgress = (pixels) => progress.push(pixels);

  return {
    manager,
    canvas,
    commands,
    progress
  };
}

function release(
  canvas: HTMLCanvasElement,
  button: 0 | 2 = 0
): void {
  canvas.dispatchEvent(new MouseEvent("mouseup", {
    button,
    bubbles: true
  }));
}

describe("PixelArtCanvas — strokes", () => {
  test("a color change mid-drag keeps the stroke, its history and its command in the starting color", () => {
    const { manager, canvas, commands, progress } = makeCanvas();
    function sampleStroke() {
      return [
        manager.document.buffer.samplePixel(8, 8),
        manager.document.buffer.samplePixel(9, 8)
      ];
    }

    canvas.dispatchEvent(mouseEvent("mousedown", 100, 100));
    manager.brush.swapColors();
    canvas.dispatchEvent(mouseEvent("mousemove", 104, 100));
    release(canvas);

    assert.strictEqual(commands.length, 1);
    const [command] = commands;
    assert.strictEqual(command.action, "stroke");
    assert.deepStrictEqual(command.metadata.color, kRed);
    assert.deepStrictEqual(sampleStroke(), [kRedBytes, kRedBytes]);
    assert.ok(
      progress.flat().every((pixel) => pixel.color.g === 0),
      "peers see the starting color only"
    );

    manager.undo();
    assert.deepStrictEqual(sampleStroke(), [kBlueBytes, kBlueBytes]);

    manager.redo();
    assert.deepStrictEqual(sampleStroke(), [kRedBytes, kRedBytes]);
    manager.destroy();
  });

  test("stroke progress reports every pixel painted so far, then an empty list when the stroke ends", () => {
    const { manager, canvas, progress } = makeCanvas();

    canvas.dispatchEvent(mouseEvent("mousedown", 100, 100));
    canvas.dispatchEvent(mouseEvent("mousemove", 104, 100));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    release(canvas);

    const first = {
      x: 8,
      y: 8,
      color: kRed
    };
    const second = {
      x: 9,
      y: 8,
      color: kRed
    };
    assert.deepStrictEqual(progress, [
      [first],
      [first, second],
      [first, second],
      []
    ]);
    manager.destroy();
  });

  test("lineHeld during a right-button stroke commits it, then draws a secondary line on release", () => {
    const { manager, canvas, commands } = makeCanvas();

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 2,
      clientX: 104,
      clientY: 100,
      bubbles: true
    }));
    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 112, 100);
    release(canvas, 2);

    assert.strictEqual(commands.length, 2);
    const [freehand, line] = commands;
    assert.strictEqual(freehand.action, "stroke");
    assert.deepStrictEqual(freehand.metadata.color, kGreen);
    assert.strictEqual(line.action, "stroke");
    assert.deepStrictEqual(line.metadata.color, kGreen);
    assert.deepStrictEqual(
      line.metadata.positions,
      [8, 9, 10, 11].map((x) => {
        return { x, y: 8 };
      })
    );
    manager.shortcuts.lineHeld = false;
    moveTo(canvas, 116, 100);
    manager.shortcuts.lineHeld = true;
    canvas.dispatchEvent(mouseEvent("mousedown", 120, 100));

    const nextLine = commands.at(-1);
    assert.strictEqual(nextLine?.action, "stroke");
    assert.deepStrictEqual(
      nextLine?.metadata.positions,
      [8, 9, 10, 11, 12, 13].map((x) => {
        return { x, y: 8 };
      })
    );
    manager.destroy();
  });

  test("releasing lineHeld clears the line preview sent to peers", () => {
    const { manager, canvas, progress } = makeCanvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 112, 100);
    manager.shortcuts.lineHeld = false;

    assert.strictEqual(progress.at(-2)?.length, 4);
    assert.deepStrictEqual(progress.at(-1), []);
    manager.destroy();
  });
});
