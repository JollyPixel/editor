// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  render,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { SelectToolbarController } from "../../src/tools/SelectToolbarController.ts";

class TestHost implements ReactiveControllerHost {
  readonly updateComplete = Promise.resolve(true);
  updateCount = 0;

  addController(_controller: ReactiveController): void {
    void _controller;
  }

  removeController(_controller: ReactiveController): void {
    void _controller;
  }

  requestUpdate(): void {
    this.updateCount++;
  }
}

type ClipboardOperationResult = Awaited<ReturnType<PixelArtCanvas["copySelection"]>>;

interface FakeCanvasState {
  canvas: PixelArtCanvas;
  select(hasSelection: boolean): void;
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
    const controller = new SelectToolbarController(new TestHost(), () => null);
    const container = document.createElement("div");

    render(controller.render(false), container);

    assert.strictEqual(container.querySelector("button"), null);
  });

  test("renders the stable button order and reads the selection at render time", () => {
    const fake = makeCanvas();
    const controller = new SelectToolbarController(new TestHost(), () => fake.canvas);
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

  test("disables selection actions without a canvas", () => {
    const controller = new SelectToolbarController(new TestHost(), () => null);
    const container = document.createElement("div");

    render(controller.render(true), container);

    assert.deepStrictEqual(disabledStates(container), [true, false, true, true, true, true]);
  });

  test("dispatches actions and blocks repeated clipboard work while pending", async() => {
    const fake = makeCanvas();
    const controller = new SelectToolbarController(new TestHost(), () => fake.canvas);
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
    const controller = new SelectToolbarController(new TestHost(), () => null);
    const container = document.createElement("div");

    controller.onClipboardResult({
      operation: "paste",
      code: "image-too-large",
      maxSize: 64
    });
    render(controller.render(true), container);
    assert.strictEqual(
      container.querySelector("[aria-live='polite']")!.textContent,
      "Image exceeds the maximum texture size of 64×64"
    );

    controller.onModeChange(false);
    render(controller.render(true), container);
    assert.strictEqual(
      container.querySelector("[aria-live='polite']")!.textContent,
      ""
    );
  });
});
