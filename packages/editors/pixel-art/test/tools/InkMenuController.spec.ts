// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { render } from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { InkMenuController } from "../../src/tools/InkMenuController.ts";
import { TestHost } from "../fixtures/host.ts";

describe("InkMenuController", () => {
  test("picking an ink sets the brush ink and moves the check to it", () => {
    const host = new TestHost();
    const canvas = {
      brush: {
        ink: "blend"
      }
    } as unknown as PixelArtCanvas;
    const controller = new InkMenuController(host);
    function checked(): string[] {
      render(controller.render(canvas), host.renderRoot);

      return [...host.renderRoot.querySelectorAll(
        "[part=ink-option][aria-checked=true] .ink-option-label"
      )].map((label) => label.textContent!);
    }

    assert.deepStrictEqual(checked(), ["Blend"]);

    host.renderRoot
      .querySelectorAll<HTMLButtonElement>("[part=ink-option]")[2]
      .click();

    assert.strictEqual(canvas.brush.ink, "lock-alpha");
    assert.deepStrictEqual(checked(), ["Lock alpha"]);
    assert.strictEqual(
      host.renderRoot.querySelector("[part=ink-button]")!.getAttribute("aria-label"),
      "Brush ink: Lock alpha"
    );
  });
});
