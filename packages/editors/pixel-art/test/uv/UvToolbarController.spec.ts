// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  html,
  nothing,
  render,
  type TemplateResult
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UvToolbarController } from "../../src/uv/UvToolbarController.ts";
import { TestHost } from "../fixtures/host.ts";

function makeCanvas(
  selectedRegionId: string | null
): PixelArtCanvas {
  const region = {
    state: "free",
    movementScope: "region"
  };

  return {
    uv: {
      selectedRegionId,
      selectedSlot: null,
      get: (id: string) => (id === selectedRegionId ? region : undefined)
    }
  } as unknown as PixelArtCanvas;
}

function renderToolbar(
  controller: UvToolbarController,
  extra: TemplateResult | typeof nothing = nothing
): Element | null {
  const container = document.createElement("div");
  render(controller.render(true, false, extra), container);

  return container.querySelector("[part=uv-toolbar]");
}

describe("UvToolbarController", () => {
  test("renders no toolbar when no region is selected and no action applies", () => {
    const controller = new UvToolbarController(new TestHost(), () => makeCanvas(null));

    assert.strictEqual(renderToolbar(controller), null);
  });

  test("renders the toolbar for a selected region or an extra action", () => {
    const selected = new UvToolbarController(new TestHost(), () => makeCanvas("block"));
    const idle = new UvToolbarController(new TestHost(), () => makeCanvas(null));

    assert.ok(renderToolbar(selected)?.querySelector("[part=uv-state-button]"));
    assert.ok(renderToolbar(idle, html`<button part="extra"></button>`)?.querySelector("[part=extra]"));
  });
});
