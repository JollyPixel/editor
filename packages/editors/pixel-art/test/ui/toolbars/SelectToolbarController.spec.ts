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
import type {
  PixelArtCanvas,
  SelectEngineEvent
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { SelectToolbarController } from "../../../src/ui/toolbars/SelectToolbarController.ts";

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

interface FakeCanvasState {
  canvas: PixelArtCanvas;
  emitSelection(hasSelection: boolean): void;
  calls: Record<string, number>;
  copyDeferred: PromiseWithResolvers<ClipboardOperationResult>;
}

type ClipboardOperationResult = Awaited<ReturnType<PixelArtCanvas["copySelection"]>>;

function makeCanvas(): FakeCanvasState {
  let listener: SelectEngineEvent["selection-state-changed"] | null = null;
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
    selectionEvents: {
      on: (
        _type: "selection-state-changed",
        nextListener: SelectEngineEvent["selection-state-changed"]
      ) => {
        listener = nextListener;
      },
      off: () => {
        listener = null;
      }
    },
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
    emitSelection(
      hasSelection: boolean
    ) {
      select.hasSelection = hasSelection;
      listener?.({ hasSelection, isFloating: false });
    }
  };
}

describe("SelectToolbarController", () => {
  test("renders the stable button order and selection-dependent disabled states", () => {
    const host = new TestHost();
    const controller = new SelectToolbarController(host);
    const fake = makeCanvas();
    const container = document.createElement("div");
    controller.attach(fake.canvas);

    render(controller.render(true), container);
    const buttons = [...container.querySelectorAll("button")];

    assert.deepStrictEqual(
      buttons.map((button) => button.getAttribute("aria-label")),
      [
        "Copy selection",
        "Paste image",
        "Rotate clockwise",
        "Flip horizontal",
        "Flip vertical",
        "Delete selection"
      ]
    );
    assert.deepStrictEqual(
      buttons.map((button) => button.disabled),
      [true, false, true, true, true, true]
    );

    fake.emitSelection(true);
    render(controller.render(true), container);
    assert.ok([...container.querySelectorAll("button")].every((button) => !button.disabled));
  });

  test("dispatches actions and blocks repeated clipboard work while pending", async() => {
    const host = new TestHost();
    const controller = new SelectToolbarController(host);
    const fake = makeCanvas();
    controller.attach(fake.canvas);
    fake.emitSelection(true);

    const firstCopy = controller.copy();
    await controller.copy();
    assert.strictEqual(fake.calls.copy, 1);
    fake.copyDeferred.resolve({ operation: "copy", code: "copied" });
    await firstCopy;

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
    const host = new TestHost();
    const controller = new SelectToolbarController(host);
    const container = document.createElement("div");

    controller.onClipboardResult({
      operation: "paste",
      code: "image-too-large",
      maxSize: 64
    });
    render(controller.render(true), container);
    const status = container.querySelector("[aria-live='polite']")!;
    assert.strictEqual(
      status.textContent,
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
