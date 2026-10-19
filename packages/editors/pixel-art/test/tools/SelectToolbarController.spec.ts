// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { render } from "lit";
import { Emitter } from "@openally/emitt";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { SelectToolbarController } from "../../src/tools/SelectToolbarController.ts";
import type { TextureSetEvents } from "../../src/textures/TextureSet.ts";
import { TestHost } from "../fixtures/host.ts";

type ClipboardOperationResult = Awaited<ReturnType<PixelArtCanvas["copySelection"]>>;

function createController(
  canvas: () => PixelArtCanvas | null,
  events = new Emitter<TextureSetEvents>()
): SelectToolbarController {
  return new SelectToolbarController(new TestHost(), canvas, events);
}

interface FakeCanvasState {
  canvas: PixelArtCanvas;
  select(hasSelection: boolean): void;
  lockPixels(): void;
  calls: Record<string, number>;
  copyDeferred: PromiseWithResolvers<ClipboardOperationResult>;
}

function makeCanvas(): FakeCanvasState {
  const calls: Record<string, number> = {
    copy: 0,
    paste: 0,
    rotate: 0,
    horizontal: 0,
    vertical: 0,
    delete: 0
  };
  const copyDeferred = Promise.withResolvers<ClipboardOperationResult>();
  const select = {
    hasSelection: false,
    shape: false,
    rotate: () => {
      calls.rotate++;

      return true;
    },
    flipHorizontal: () => {
      calls.horizontal++;

      return true;
    },
    flipVertical: () => {
      calls.vertical++;

      return true;
    },
    delete: () => {
      calls.delete++;

      return true;
    }
  };
  const canvas = {
    pixelsReadOnly: false,
    tools: { select },
    copySelection: () => {
      calls.copy++;

      return copyDeferred.promise;
    },
    pasteClipboard: async() => {
      calls.paste++;

      return { operation: "paste", code: "pasted" } as const;
    }
  } as unknown as PixelArtCanvas;

  return {
    canvas,
    calls,
    copyDeferred,
    select(
      hasSelection: boolean
    ) {
      select.hasSelection = hasSelection;
    },
    lockPixels() {
      Object.assign(canvas, { pixelsReadOnly: true });
    }
  };
}

function disabledStates(
  container: HTMLElement
): boolean[] {
  return [...container.querySelectorAll("button")].map((button) => button.disabled);
}

describe("SelectToolbarController", () => {
  test("renders nothing outside Select mode", () => {
    const controller = createController(() => null);
    const container = document.createElement("div");

    render(controller.render(false), container);

    assert.strictEqual(container.querySelector("button"), null);
  });

  test("renders the stable button order and reads the selection at render time", () => {
    const fake = makeCanvas();
    const controller = createController(() => fake.canvas);
    const container = document.createElement("div");

    render(controller.render(true), container);

    assert.deepStrictEqual(
      [...container.querySelectorAll("button")].map((button) => button.getAttribute("aria-label")),
      [
        "Copy selection",
        "Paste image",
        "Rotate clockwise",
        "Flip horizontal",
        "Flip vertical",
        "Delete selection"
      ]
    );
    assert.deepStrictEqual(disabledStates(container), [true, false, true, true, true, true]);

    fake.select(true);
    render(controller.render(true), container);
    assert.ok(disabledStates(container).every((disabled) => !disabled));
  });

  test("keeps copy but disables paste and edits while pixels are read-only", () => {
    const fake = makeCanvas();
    const controller = createController(() => fake.canvas);
    const container = document.createElement("div");
    fake.select(true);
    fake.lockPixels();

    render(controller.render(true), container);

    assert.deepStrictEqual(disabledStates(container), [false, true, true, true, true, true]);
  });

  test("disables selection actions without a canvas", () => {
    const controller = createController(() => null);
    const container = document.createElement("div");

    render(controller.render(true), container);

    assert.deepStrictEqual(disabledStates(container), [true, false, true, true, true, true]);
  });

  test("dispatches actions and blocks repeated clipboard work while pending", async() => {
    const fake = makeCanvas();
    const controller = createController(() => fake.canvas);
    fake.select(true);

    const firstCopy = controller.copy();
    await controller.copy();
    await controller.paste();
    assert.strictEqual(fake.calls.copy, 1);
    assert.strictEqual(fake.calls.paste, 0);
    fake.copyDeferred.resolve({ operation: "copy", code: "copied" });
    await firstCopy;
    await controller.paste();
    assert.strictEqual(fake.calls.paste, 1);

    const container = document.createElement("div");
    render(controller.render(true), container);
    container.querySelector<HTMLButtonElement>("[aria-label='Rotate clockwise']")!.click();
    container.querySelector<HTMLButtonElement>("[aria-label='Flip horizontal']")!.click();
    container.querySelector<HTMLButtonElement>("[aria-label='Flip vertical']")!.click();
    container.querySelector<HTMLButtonElement>("[aria-label='Delete selection']")!.click();

    assert.strictEqual(fake.calls.rotate, 1);
    assert.strictEqual(fake.calls.horizontal, 1);
    assert.strictEqual(fake.calls.vertical, 1);
    assert.strictEqual(fake.calls.delete, 1);
  });

  test("renders clipboard status in a polite live region and clears it on mode exit", () => {
    const events = new Emitter<TextureSetEvents>();
    const controller = createController(() => null, events);
    const container = document.createElement("div");
    function status(): string | null {
      render(controller.render(true), container);

      return container.querySelector("[aria-live='polite']")!.textContent;
    }

    events.emit("clipboard-result", {
      operation: "paste",
      code: "image-too-large",
      maxSize: 64
    });
    assert.strictEqual(status(), "Image exceeds the maximum texture size of 64×64");

    events.emit("mode-change", "select");
    assert.strictEqual(status(), "Image exceeds the maximum texture size of 64×64");

    events.emit("mode-change", "paint");
    assert.strictEqual(status(), "");
  });

  test("clears the clipboard status when another texture becomes active", () => {
    const events = new Emitter<TextureSetEvents>();
    const controller = createController(() => null, events);
    const container = document.createElement("div");

    events.emit("clipboard-result", {
      operation: "copy",
      code: "copied"
    });
    events.emit("active-change");
    render(controller.render(true), container);

    assert.strictEqual(
      container.querySelector("[aria-live='polite']")!.textContent,
      ""
    );
  });
});
