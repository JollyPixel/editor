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
import type {
  PixelArtCanvas,
  UVNet
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UvToolbarController } from "../../src/uv/UvToolbarController.ts";
import { UvNetController } from "../../src/uv/nets/UvNetController.ts";
import { UvNetLibrary } from "../../src/uv/nets/UvNetLibrary.ts";
import { TestHost } from "../fixtures/host.ts";
import { UvNetTestDocument } from "../fixtures/uvNetDocument.ts";

interface FakeCanvas {
  canvas: PixelArtCanvas;
  unfolded: [string, UVNet][];
}

function makeCanvas(
  selectedRegionId: string | null,
  activeSlots = ["front", "back", "left", "right", "top", "bottom"]
): FakeCanvas {
  const unfolded: [string, UVNet][] = [];
  const region = {
    state: "free",
    movementScope: "region",
    activeSlots
  };
  const canvas = {
    document: new UvNetTestDocument(),
    uv: {
      selectedRegionId,
      selectedSlot: null,
      get: (id: string) => (id === selectedRegionId ? region : undefined),
      unfold: (id: string, net: UVNet) => {
        unfolded.push([id, net]);

        return true;
      }
    }
  } as unknown as PixelArtCanvas;

  return {
    canvas,
    unfolded
  };
}

function makeToolbar(
  { canvas }: FakeCanvas,
  library = new UvNetLibrary()
): UvToolbarController {
  const host = new TestHost();
  const nets = new UvNetController(host, {
    canvas: () => canvas,
    dialog: () => {
      throw new Error("no dialog in unit tests");
    },
    adopt: () => undefined
  });
  nets.library = library;

  return new UvToolbarController(host, () => canvas, nets);
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
    const controller = makeToolbar(makeCanvas(null));

    assert.strictEqual(renderToolbar(controller), null);
  });

  test("renders the toolbar for a selected region or an extra action", () => {
    const selected = makeToolbar(makeCanvas("block"));
    const idle = makeToolbar(makeCanvas(null));

    assert.ok(renderToolbar(selected)?.querySelector("[part=uv-state-button]"));
    assert.ok(renderToolbar(idle, html`<button part="extra"></button>`)?.querySelector("[part=extra]"));
  });

  test("unfolds the selected region with a fitting net and greys out nets missing its slots", () => {
    const fake = makeCanvas("block", ["front", "back", "left", "right", "top", "bottom", "top.1"]);
    const library = new UvNetLibrary();
    const controller = makeToolbar(fake, library);
    const capsOnly = library.create("Caps", [[["top", "top.1"]]])!;
    const toolbar = renderToolbar(controller)!;
    function option(
      id: string
    ): HTMLButtonElement {
      return toolbar.querySelector<HTMLButtonElement>(`[part=uv-net-option][data-net="${id}"]`)!;
    }

    option("cross").click();
    option(capsOnly.id).click();
    option("packed").click();

    assert.strictEqual(option("cross").title, "Missing slots: top.1");
    assert.strictEqual(option("cross").getAttribute("aria-disabled"), "true");
    assert.strictEqual(option(capsOnly.id).title, "Missing slots: front, back, left, right, bottom");
    assert.deepStrictEqual(fake.unfolded, [["block", library.get("packed")!.net]]);
  });
});
