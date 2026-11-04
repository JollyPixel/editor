// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  COLOR_PALETTE_MAX_SIZE,
  ColorPalette
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { rgba8ToColorChange } from "../../src/color/pickerChange.ts";
import {
  color,
  BLACK,
  WHITE,
  setup
} from "./fixtures/paletteCanvas.ts";

describe("UI.ColorController palette edits", () => {
  test("shift click extends the range and the ramp fills it in the chosen space as one edit", () => {
    const { controller, options, doc } = setup();
    controller.docked = true;
    doc.changePaletteColor(2, BLACK);
    doc.changePaletteColor(4, WHITE);
    controller.selectPaletteColor(2);
    controller.extendPaletteSelection(4);

    controller.editPalette({ type: "ramp" });
    assert.deepEqual(doc.palette.colorAt(3), { r: 99, g: 99, b: 99, a: 255 });
    options.space = "srgb";
    controller.editPalette({ type: "ramp" });

    assert.deepEqual(doc.palette.colorAt(3), { r: 128, g: 128, b: 128, a: 255 });
    assert.equal(doc.replaced, 2);
    assert.deepEqual(controller.foreground, color("#ffffff"));
  });

  test("palette edits leave a locked palette alone, and a ramp needs three slots", () => {
    const { controller, doc } = setup();
    controller.docked = true;
    controller.selectPaletteColor(0);
    controller.extendPaletteSelection(1);

    controller.editPalette({ type: "ramp" });
    controller.paletteLocked = true;
    controller.extendPaletteSelection(5);
    for (const type of ["ramp", "reverse", "duplicate", "remove", "add"] as const) {
      controller.editPalette({ type });
    }

    assert.deepEqual(doc.palette.toJSON(), ColorPalette.create().toJSON());
    assert.equal(doc.replaced, 0);
    assert.deepEqual(controller.foreground, rgba8ToColorChange(doc.palette.colorAt(5)));
  });

  test("sort and reverse act on the range, or on the whole palette without one", () => {
    const { controller, doc } = setup();
    controller.docked = true;
    const colors = ColorPalette.create().toJSON();

    controller.selectPaletteColor(0);
    controller.extendPaletteSelection(2);
    controller.editPalette({ type: "reverse" });
    assert.deepEqual(doc.palette.toJSON().slice(0, 4), [colors[2], colors[1], colors[0], colors[3]]);

    controller.selectPaletteColor(0);
    controller.editPalette({ type: "sort", key: "lightness" });
    assert.deepEqual(doc.palette.colorAt(0), BLACK);
    assert.deepEqual(doc.palette.colorAt(9), WHITE);
  });

  test("duplicate copies the range after itself and delete removes it, keeping one color", () => {
    const { controller, doc } = setup();
    controller.docked = true;
    const colors = ColorPalette.create().toJSON();
    controller.selectPaletteColor(3);
    controller.extendPaletteSelection(4);

    controller.editPalette({ type: "duplicate" });
    assert.equal(doc.palette.size, 12);
    assert.deepEqual(doc.palette.toJSON().slice(3, 7), [colors[3], colors[4], colors[3], colors[4]]);
    assert.deepEqual(controller.foreground, rgba8ToColorChange(colors[4]));

    controller.editPalette({ type: "remove" });
    assert.deepEqual(doc.palette.toJSON(), colors);

    controller.selectPaletteColor(0);
    controller.extendPaletteSelection(9);
    controller.editPalette({ type: "remove" });
    assert.equal(doc.palette.size, 10);
  });

  test("add inserts the active color at the end, or after the selected slot", () => {
    const { controller, doc } = setup();
    controller.docked = true;
    controller.changeActive(color("#123456"));

    controller.editPalette({ type: "add" });
    assert.deepEqual(doc.palette.colorAt(10), { r: 18, g: 52, b: 86, a: 255 });
    controller.selectPaletteColor(1);
    controller.editPalette({ type: "add" });

    assert.equal(doc.palette.size, 12);
    assert.deepEqual(doc.palette.colorAt(2), WHITE);
    assert.deepEqual(doc.palette.colorAt(11), { r: 18, g: 52, b: 86, a: 255 });
  });

  test("dropping a slot of the range moves the whole range, and copy duplicates it", () => {
    const { controller, doc } = setup();
    controller.docked = true;
    const colors = ColorPalette.create().toJSON();
    controller.selectPaletteColor(0);
    controller.extendPaletteSelection(1);

    controller.dropPaletteColors({ from: 1, to: 9, copy: false });
    assert.deepEqual(doc.palette.toJSON().slice(7), [colors[9], colors[0], colors[1]]);

    controller.dropPaletteColors({ from: 5, to: 0, copy: true });
    assert.equal(doc.palette.size, 11);
    assert.deepEqual(doc.palette.colorAt(0), colors[7]);
  });

  test("a peer shrinking the palette keeps the selection inside it", () => {
    const { host, controller, doc } = setup();
    host.connect();
    controller.docked = true;
    controller.selectPaletteColor(9);

    doc.replacePalette(ColorPalette.from([BLACK, WHITE]));

    assert.deepEqual(controller.foreground, color("#ffffff"));
  });

  test("stepping through slots wraps around and needs the docked picker", () => {
    const { controller } = setup();

    assert.equal(controller.stepPaletteColor(1), false);
    controller.docked = true;
    assert.equal(controller.stepPaletteColor(-1), true);
    assert.deepEqual(controller.foreground, color("#a050c8"));
    controller.stepPaletteColor(1);

    assert.deepEqual(controller.foreground, color("#000000"));
  });

  test("a strip color drops the selected slot and becomes recent, shift adds it", () => {
    const { controller, doc } = setup();
    controller.docked = true;
    controller.selectPaletteColor(3);

    controller.pickStripColor({ hex: "#336699", opacity: 1, add: false });
    assert.deepEqual(controller.foreground, color("#336699"));
    assert.deepEqual(doc.palette.colorAt(3), ColorPalette.create().colorAt(3));
    assert.deepEqual(controller.recentColors, [color("#336699")]);

    controller.pickStripColor({ hex: "#663399", opacity: 0.5, add: true });
    assert.equal(doc.palette.size, 11);
    assert.deepEqual(doc.palette.colorAt(10), { r: 102, g: 51, b: 153, a: 128 });
  });

  test("a palette from the texture keeps its first 256 colors and says so", () => {
    const { controller, options, doc } = setup();
    const colors = Array.from(
      { length: COLOR_PALETTE_MAX_SIZE + 2 },
      (_, index) => [index % 256, index >> 8, 0, 255]
    );
    doc.pixels = new Uint8ClampedArray(colors.flat());

    controller.editPalette({ type: "from-texture" });

    assert.equal(doc.palette.size, COLOR_PALETTE_MAX_SIZE);
    assert.deepEqual(doc.palette.colorAt(0), BLACK);
    assert.deepEqual(options.messages, ["Kept the first 256 colors of the texture"]);
  });

  test("a texture without visible colors keeps the palette and says so", () => {
    const { controller, options, doc } = setup();

    controller.editPalette({ type: "from-texture" });

    assert.equal(doc.replaced, 0);
    assert.deepEqual(options.messages, ["The texture has no visible colors"]);
  });
});
