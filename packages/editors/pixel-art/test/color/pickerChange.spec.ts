// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyPickerChange,
  colorChangeOf,
  colorDetailOf,
  colorWithOpacity,
  pickerSource,
  rgba8Of,
  type ColorValueElement
} from "../../src/color/pickerChange.ts";
import type { ColorChangeDetail } from "../../src/color/ColorSwatch.ts";

function swatch(
  color = "#000000",
  opacity = 1
): ColorValueElement & { changes: ColorChangeDetail[]; } {
  const element = document.createElement("div");

  return Object.assign(element, {
    color,
    opacity,
    changes: [] as ColorChangeDetail[]
  });
}

function listening(
  element: ColorValueElement & { changes: ColorChangeDetail[]; }
): typeof element {
  element.addEventListener("color-change", (event) => {
    if (event instanceof CustomEvent) {
      element.changes.push(event.detail);
    }
  });

  return element;
}

describe("colorWithOpacity", () => {
  test("keeps the channels and replaces alpha", () => {
    assert.deepEqual(
      colorWithOpacity("#336699", 0.5),
      { r: 0.2, g: 0.4, b: 0.6, a: 0.5 }
    );
  });

  test("falls back to black for an unparsable color", () => {
    assert.deepEqual(
      colorWithOpacity("not-a-color", 0.25),
      { r: 0, g: 0, b: 0, a: 0.25 }
    );
  });
});

describe("colorChangeOf", () => {
  test("splits an eight-digit hex into a color and an opacity", () => {
    assert.deepEqual(
      colorChangeOf("#33669980"),
      { hex: "#336699", opacity: 128 / 255 }
    );
  });

  test("returns null for an unparsable value", () => {
    assert.equal(colorChangeOf("#zzz"), null);
  });
});

describe("pickerSource", () => {
  test("reads the element's color and opacity as an eight-digit hex", () => {
    const source = pickerSource(swatch("#336699", 1));

    assert.equal(source.read(), "#336699ff");
  });

  test("a write updates the element and raises one color-change", () => {
    const element = listening(swatch());
    const source = pickerSource(element);

    source.write("#ff0000ff", true);

    assert.equal(element.color, "#ff0000");
    assert.equal(element.opacity, 1);
    assert.deepEqual(element.changes, [
      { hex: "#ff0000", opacity: 1 }
    ]);
  });

  test("an unparsable write leaves the element untouched", () => {
    const element = listening(swatch("#123456", 0.5));
    const source = pickerSource(element);

    source.write("nope", true);

    assert.equal(element.color, "#123456");
    assert.equal(element.opacity, 0.5);
    assert.deepEqual(element.changes, []);
  });

  test("an input write raises color-preview instead of color-change", () => {
    const element = listening(swatch());
    const previews: ColorChangeDetail[] = [];
    element.addEventListener("color-preview", (event) => {
      if (event instanceof CustomEvent) {
        previews.push(event.detail);
      }
    });

    pickerSource(element).write("#ff000080", false);

    assert.deepEqual(previews, [{ hex: "#ff0000", opacity: 128 / 255 }]);
    assert.deepEqual(element.changes, []);
  });

  test("read reflects what a write just applied", () => {
    const element = swatch();
    const source = pickerSource(element);

    source.write("#00ff0080", true);

    assert.equal(source.read(), "#00ff0080");
  });
});

describe("applyPickerChange", () => {
  test("bubbles and composes the color-change event", () => {
    const element = swatch();
    let composed = false;
    let bubbles = false;
    element.addEventListener("color-change", (event) => {
      composed = event.composed;
      bubbles = event.bubbles;
    });

    applyPickerChange(element, "#abcdefff");

    assert.equal(composed, true);
    assert.equal(bubbles, true);
  });
});

describe("colorDetailOf and rgba8Of", () => {
  test("convert between byte colors and picker details", () => {
    const detail = colorDetailOf({ r: 18, g: 52, b: 86, a: 128 });

    assert.deepEqual(detail, { hex: "#123456", opacity: 128 / 255 });
    assert.deepEqual(rgba8Of(detail), { r: 18, g: 52, b: 86, a: 128 });
  });
});
