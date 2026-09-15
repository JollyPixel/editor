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
import { ColorController } from "../../../src/ui/color/ColorController.ts";
import type { ColorChangeDetail } from "../../../src/ui/color/ColorSwatch.ts";

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

function colorEvent(
  hex: string,
  opacity = 1
): CustomEvent<ColorChangeDetail> {
  return {
    detail: {
      hex,
      opacity
    }
  } as CustomEvent<ColorChangeDetail>;
}

function setup() {
  const host = new TestHost();
  const controller = new ColorController(host);
  const { canvas, brush } = makeCanvas();
  controller.attach(canvas);

  return {
    host,
    controller,
    brush
  };
}

describe("UI.ColorController", () => {
  test("docking copies the foreground into both brush slots", () => {
    const { host, controller, brush } = setup();

    controller.docked = true;

    assert.equal(controller.docked, true);
    assert.equal(brush.secondary.hex, "#111111");
    assert.equal(brush.secondary.opacity, 1);
    assert.deepEqual(controller.background, controller.foreground);
    assert.equal(host.updateCount, 1);
  });

  test("an active change writes both slots while docked", () => {
    const { controller, brush } = setup();
    controller.docked = true;

    controller.onForegroundChange(colorEvent("#ff6600", 0.8));

    assert.equal(brush.primary.hex, "#ff6600");
    assert.equal(brush.secondary.hex, "#ff6600");
    assert.equal(brush.secondary.opacity, 0.8);
  });

  test("undocking restores the background held before docking", () => {
    const { controller, brush } = setup();
    controller.docked = true;
    controller.onActiveChange(colorEvent("#00ff00"));

    controller.docked = false;

    assert.equal(brush.primary.hex, "#00ff00");
    assert.equal(brush.secondary.hex, "#eeeeee");
    assert.equal(brush.secondary.opacity, 0.5);
    assert.deepEqual(controller.background, {
      hex: "#eeeeee",
      opacity: 0.5
    });
  });

  test("docking before attach applies once the canvas attaches", () => {
    const host = new TestHost();
    const controller = new ColorController(host);
    const { canvas, brush } = makeCanvas();

    controller.docked = true;
    controller.attach(canvas);
    controller.docked = false;

    assert.equal(brush.secondary.hex, "#eeeeee");
  });

  test("swap and background changes are ignored while docked", () => {
    const { controller, brush } = setup();
    controller.docked = true;

    controller.swap();
    controller.onBackgroundChange(colorEvent("#0000ff"));

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

  test("an undocked eyedropper pick updates only its slot", () => {
    const { controller } = setup();

    controller.onColorPicked({
      hex: "#3355ff",
      opacity: 1,
      slot: "secondary"
    });

    assert.equal(controller.foreground.hex, "#111111");
    assert.equal(controller.background.hex, "#3355ff");
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
