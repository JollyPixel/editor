// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  ColorPalette,
  type PixelArtCanvas,
  type RGBA8
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { ColorController } from "../../src/color/ColorController.ts";
import type { ColorChangeDetail } from "../../src/color/ColorSwatch.ts";
import type { TextureSetEvents } from "../../src/textures/TextureSet.ts";
import { createElementHost as createHost } from "../fixtures/host.ts";

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
  const host = createHost();
  const { canvas, brush, doc } = makeCanvas();
  const controller = new ColorController(
    host,
    () => canvas,
    new Emitter<TextureSetEvents>()
  );

  return {
    host,
    controller,
    brush,
    doc
  };
}

describe("UI.ColorController palette", () => {
  test("selecting a slot writes its color into both brush slots", () => {
    const { controller, brush } = setup();
    controller.docked = true;

    controller.selectPaletteColor(3);

    assert.deepEqual(controller.foreground, color("#e63946"));
    assert.equal(brush.secondary.hex, "#e63946");
  });

  test("a committed change writes the selected slot, a deselected one does not", () => {
    const { controller, doc } = setup();
    controller.docked = true;
    controller.selectPaletteColor(3);

    controller.changeActive(color("#112233", 128 / 255));
    assert.deepEqual(doc.palette.colorAt(3), { r: 17, g: 34, b: 51, a: 128 });

    controller.deselectPaletteColor();
    controller.changeActive(color("#445566"));
    assert.deepEqual(doc.palette.colorAt(3), { r: 17, g: 34, b: 51, a: 128 });
    assert.deepEqual(controller.foreground, color("#445566"));
  });

  test("a committed change on a locked palette leaves the slot and deselects it", () => {
    const { controller, doc } = setup();
    controller.docked = true;
    controller.selectPaletteColor(3);
    controller.paletteLocked = true;

    controller.changeActive(color("#112233"));
    controller.paletteLocked = false;
    controller.changeActive(color("#445566"));

    assert.deepEqual(doc.palette.colorAt(3), ColorPalette.create().colorAt(3));
    assert.deepEqual(controller.foreground, color("#445566"));
  });

  test("cancelling a preview restores the slot color saved meanwhile", () => {
    const { host, controller, brush, doc } = setup();
    host.connect();
    controller.docked = true;
    controller.selectPaletteColor(3);

    controller.previewActive(color("#abcdef"));
    doc.changePaletteColor(3, { r: 0, g: 0, b: 255, a: 255 });
    assert.equal(brush.primary.hex, "#abcdef");

    controller.cancelDraft();
    assert.deepEqual(controller.foreground, color("#0000ff"));
    assert.equal(brush.secondary.hex, "#0000ff");
  });

  test("a peer change to the selected slot reaches the docked brush", () => {
    const { host, controller, doc } = setup();
    host.connect();
    controller.docked = true;
    controller.selectPaletteColor(3);

    doc.changePaletteColor(4, { r: 0, g: 255, b: 0, a: 255 });
    assert.deepEqual(controller.foreground, color("#e63946"));

    doc.changePaletteColor(3, { r: 0, g: 0, b: 255, a: 255 });
    assert.deepEqual(controller.foreground, color("#0000ff"));
  });

  test("each document keeps its own selected slot", () => {
    const host = createHost();
    const first = makeCanvas();
    const second = makeCanvas();
    const events = new Emitter<TextureSetEvents>();
    let current = first.canvas;
    const controller = new ColorController(host, () => current, events);
    host.connect();
    controller.docked = true;
    controller.selectPaletteColor(3);

    current = second.canvas;
    events.emit("active-change");
    controller.changeActive(color("#445566"));
    assert.deepEqual(second.doc.palette.toJSON(), ColorPalette.create().toJSON());

    current = first.canvas;
    events.emit("active-change");
    assert.deepEqual(controller.foreground, color("#e63946"));
  });
});
