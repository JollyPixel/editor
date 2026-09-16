// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { ColorController } from "../../src/color/ColorController.ts";
import type { ColorChangeDetail } from "../../src/color/ColorSwatch.ts";

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

class FakeBrushColor {
  hex: string;
  opacity: number;

  constructor(
    hex: string,
    opacity = 1
  ) {
    this.hex = hex;
    this.opacity = opacity;
  }

  set(
    hex: string,
    opacity = 1
  ): void {
    this.hex = hex;
    this.opacity = opacity;
  }

  asString(): string {
    return this.hex;
  }
}

interface FakeBrush {
  primary: FakeBrushColor;
  secondary: FakeBrushColor;
  swapColors(): void;
}

function makeCanvas(): { canvas: PixelArtCanvas; brush: FakeBrush; } {
  const brush: FakeBrush = {
    primary: new FakeBrushColor("#111111"),
    secondary: new FakeBrushColor("#eeeeee", 0.5),
    swapColors() {
      [brush.primary, brush.secondary] = [brush.secondary, brush.primary];
    }
  };
  const canvas = { brush } as unknown as PixelArtCanvas;

  return {
    canvas,
    brush
  };
}

function color(
  hex: string,
  opacity = 1
): ColorChangeDetail {
  return {
    hex,
    opacity
  };
}

function setup() {
  const host = new TestHost();
  const { canvas, brush } = makeCanvas();
  const controller = new ColorController(host, () => canvas);

  return {
    host,
    controller,
    brush
  };
}

describe("UI.ColorController", () => {
  test("reads the brush colors of the active canvas", () => {
    const { controller, brush } = setup();

    brush.primary.set("#abcdef", 0.25);

    assert.deepEqual(controller.foreground, color("#abcdef", 0.25));
    assert.deepEqual(controller.background, color("#eeeeee", 0.5));
  });

  test("reads default colors without a canvas", () => {
    const controller = new ColorController(new TestHost(), () => null);

    assert.deepEqual(controller.foreground, color("#000000"));
    assert.deepEqual(controller.background, color("#ffffff"));
  });

  test("docking copies the foreground into both brush slots", () => {
    const { host, controller, brush } = setup();

    controller.docked = true;

    assert.equal(controller.docked, true);
    assert.equal(brush.secondary.hex, "#111111");
    assert.equal(brush.secondary.opacity, 1);
    assert.deepEqual(controller.background, controller.foreground);
    assert.equal(host.updateCount, 1);
  });

  test("a foreground change writes both slots while docked", () => {
    const { controller, brush } = setup();
    controller.docked = true;

    controller.changeForeground(color("#ff6600", 0.8));

    assert.equal(brush.primary.hex, "#ff6600");
    assert.equal(brush.secondary.hex, "#ff6600");
    assert.equal(brush.secondary.opacity, 0.8);
  });

  test("a foreground change writes only the primary slot when undocked", () => {
    const { controller, brush } = setup();

    controller.changeForeground(color("#ff6600"));

    assert.equal(brush.primary.hex, "#ff6600");
    assert.equal(brush.secondary.hex, "#eeeeee");
  });

  test("undocking restores the background held before docking", () => {
    const { controller, brush } = setup();
    controller.docked = true;
    controller.changeActive(color("#00ff00"));

    controller.docked = false;

    assert.equal(brush.primary.hex, "#00ff00");
    assert.equal(brush.secondary.hex, "#eeeeee");
    assert.equal(brush.secondary.opacity, 0.5);
    assert.deepEqual(controller.background, color("#eeeeee", 0.5));
  });

  test("docking before a canvas exists applies once the canvas is adopted", () => {
    const { canvas, brush } = makeCanvas();
    let current: PixelArtCanvas | null = null;
    const controller = new ColorController(new TestHost(), () => current);

    controller.docked = true;
    current = canvas;
    controller.adopt();

    assert.equal(brush.secondary.hex, "#111111");

    controller.docked = false;

    assert.equal(brush.secondary.hex, "#eeeeee");
    assert.equal(brush.secondary.opacity, 0.5);
  });

  test("adopting while undocked leaves the brush untouched", () => {
    const { controller, brush } = setup();

    controller.adopt();

    assert.equal(brush.primary.hex, "#111111");
    assert.equal(brush.secondary.hex, "#eeeeee");
  });

  test("swap exchanges the brush colors when undocked", () => {
    const { controller } = setup();

    controller.swap();

    assert.equal(controller.foreground.hex, "#eeeeee");
    assert.equal(controller.background.hex, "#111111");
  });

  test("swap and background changes are ignored while docked", () => {
    const { controller, brush } = setup();
    controller.docked = true;

    controller.swap();
    controller.changeBackground(color("#0000ff"));

    assert.equal(brush.primary.hex, "#111111");
    assert.equal(brush.secondary.hex, "#111111");
  });

  test("a docked eyedropper pick writes both slots whatever the slot", () => {
    const { controller, brush } = setup();
    controller.docked = true;

    controller.onColorPicked({
      hex: "#3355ff",
      opacity: 1,
      slot: "secondary"
    });

    assert.equal(brush.primary.hex, "#3355ff");
    assert.equal(brush.secondary.hex, "#3355ff");
    assert.equal(controller.foreground.hex, "#3355ff");
  });

  test("an undocked eyedropper pick only refreshes the host", () => {
    const { host, controller, brush } = setup();
    brush.secondary.set("#3355ff");

    controller.onColorPicked({
      hex: "#3355ff",
      opacity: 1,
      slot: "secondary"
    });

    assert.equal(brush.primary.hex, "#111111");
    assert.equal(controller.background.hex, "#3355ff");
    assert.equal(host.updateCount, 1);
  });

  test("docking reads colors written directly to the brush", () => {
    const { controller, brush } = setup();
    brush.primary.set("#abcdef");
    brush.secondary.set("#222222");

    controller.docked = true;
    assert.equal(brush.secondary.hex, "#abcdef");

    controller.docked = false;
    assert.equal(brush.secondary.hex, "#222222");
  });

  test("setting the same docked state is a no-op", () => {
    const { host, controller } = setup();

    controller.docked = false;

    assert.equal(host.updateCount, 0);
  });
});
