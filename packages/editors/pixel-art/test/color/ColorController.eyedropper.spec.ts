// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ReactiveController, ReactiveControllerHost } from "lit";
import {
  ColorPalette,
  type PixelArtCanvas,
  type RGBA8
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { ColorController } from "../../src/color/ColorController.ts";

type TestHost = HTMLElement & ReactiveControllerHost & {
  updateCount: number;
  connect(): void;
  update(): void;
};

function createHost(): TestHost {
  const controllers: ReactiveController[] = [];

  return Object.assign(document.createElement("div"), {
    updateComplete: Promise.resolve(true),
    updateCount: 0,
    addController(controller: ReactiveController): void {
      controllers.push(controller);
    },
    removeController(_controller: ReactiveController): void {
      void _controller;
    },
    requestUpdate(): void {
      this.updateCount++;
    },
    connect(): void {
      for (const controller of controllers) {
        controller.hostConnected?.();
      }
    },
    update(): void {
      for (const controller of controllers) {
        controller.hostUpdate?.();
      }
    }
  });
}

class FakeDocument {
  palette = ColorPalette.create();
  readonly #listeners = new Set<(index: number | null) => void>();

  subscribe(
    _event: "palette-changed",
    listener: (index: number | null) => void
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  changePaletteColor(
    index: number,
    color: RGBA8
  ): void {
    this.palette = this.palette.withColor(index, color);
    for (const listener of this.#listeners) {
      listener(index);
    }
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

function makeCanvas(): {
  canvas: PixelArtCanvas;
  brush: FakeBrush;
  doc: FakeDocument;
} {
  const brush: FakeBrush = {
    primary: new FakeBrushColor("#111111"),
    secondary: new FakeBrushColor("#eeeeee", 0.5),
    swapColors() {
      [brush.primary, brush.secondary] = [brush.secondary, brush.primary];
    }
  };
  const doc = new FakeDocument();
  const element = document.createElement("canvas");
  const canvas = {
    brush,
    document: doc,
    canvas: () => element
  } as unknown as PixelArtCanvas;

  return {
    canvas,
    brush,
    doc
  };
}

function setup() {
  const host = createHost();
  const { canvas, brush, doc } = makeCanvas();
  const controller = new ColorController(host, () => canvas);

  return {
    host,
    controller,
    brush,
    doc
  };
}

describe("UI.ColorController", () => {
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
