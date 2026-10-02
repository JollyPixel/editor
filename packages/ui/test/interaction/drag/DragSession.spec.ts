// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import type { Rect } from "../../../src/geometry/Rect.ts";
import {
  startDragSession,
  type DragZone
} from "../../../src/interaction/drag/DragSession.ts";

function pointer(
  type: string,
  clientX: number,
  clientY: number
): PointerEvent {
  return new PointerEvent(type, {
    pointerId: 1,
    clientX,
    clientY
  });
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number
): Rect {
  return {
    x,
    y,
    width,
    height
  };
}

function column(
  id: string,
  x: number,
  lines: number[]
): DragZone {
  return {
    id,
    rect: rect(x, 0, 100, 300),
    axis: "y",
    candidates: [
      {
        start: 0,
        size: 100
      },
      {
        start: 100,
        size: 100
      }
    ],
    line: (index) => {
      lines.push(index);

      return rect(x, index * 100, 100, 2);
    }
  };
}

function insertion(): HTMLElement {
  const element = document.querySelector<HTMLElement>(".jolly-drag-insertion");
  assert.ok(element !== null);

  return element;
}

describe("Interaction.startDragSession", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("measures the insertion line once per zone and index", () => {
    const source = document.createElement("div");
    document.body.append(source);
    const lines: number[] = [];
    const zone = column("left", 0, lines);
    startDragSession({
      source,
      event: pointer("pointerdown", 50, 10),
      ghostLabel: "Pane",
      zones: () => [zone],
      onCommit: () => undefined
    });

    source.dispatchEvent(pointer("pointermove", 50, 20));
    source.dispatchEvent(pointer("pointermove", 51, 22));
    source.dispatchEvent(pointer("pointermove", 52, 30));
    assert.deepEqual(lines, [0]);
    assert.equal(insertion().style.top, "0px");

    source.dispatchEvent(pointer("pointermove", 50, 120));
    assert.deepEqual(lines, [0, 1]);
    assert.equal(insertion().style.top, "100px");

    source.dispatchEvent(pointer("pointerup", 50, 120));
  });

  test("measures again after leaving the zone or scrolling", () => {
    const source = document.createElement("div");
    document.body.append(source);
    const lines: number[] = [];
    const zone = column("left", 0, lines);
    startDragSession({
      source,
      event: pointer("pointerdown", 50, 10),
      ghostLabel: "Pane",
      zones: () => [zone],
      onCommit: () => undefined
    });

    source.dispatchEvent(pointer("pointermove", 50, 20));
    source.dispatchEvent(pointer("pointermove", 500, 20));
    assert.equal(insertion().style.display, "none");

    source.dispatchEvent(pointer("pointermove", 50, 20));
    assert.equal(insertion().style.display, "block");
    window.dispatchEvent(new Event("scroll"));
    source.dispatchEvent(pointer("pointermove", 50, 21));
    assert.deepEqual(lines, [0, 0, 0]);

    source.dispatchEvent(pointer("pointerup", 50, 21));
  });

  test("hides the line where the drop moves nothing", () => {
    const source = document.createElement("div");
    document.body.append(source);
    const lines: number[] = [];
    const zone: DragZone = {
      ...column("left", 0, lines),
      source: 0
    };
    startDragSession({
      source,
      event: pointer("pointerdown", 50, 10),
      ghostLabel: "Pane",
      zones: () => [zone],
      onCommit: () => undefined
    });

    source.dispatchEvent(pointer("pointermove", 50, 20));
    assert.deepEqual(lines, []);
    assert.equal(insertion().style.display, "none");

    source.dispatchEvent(pointer("pointermove", 50, 260));
    assert.deepEqual(lines, [2]);
    assert.equal(insertion().style.display, "block");

    source.dispatchEvent(pointer("pointerup", 50, 260));
  });

  test("restyles the zone bands only when the armed zone changes", () => {
    const source = document.createElement("div");
    document.body.append(source);
    const left = column("left", 0, []);
    const right = column("right", 200, []);
    startDragSession({
      source,
      event: pointer("pointerdown", 50, 10),
      ghostLabel: "Pane",
      zones: () => [left, right],
      onCommit: () => undefined
    });

    source.dispatchEvent(pointer("pointermove", 50, 20));
    const bands = [...document.querySelectorAll<HTMLElement>(".jolly-drag-zone")];
    const armed = bands.find((band) => band.classList.contains("jolly-drag-zone-armed"));
    assert.ok(armed !== undefined);
    armed.style.left = "-1px";

    source.dispatchEvent(pointer("pointermove", 55, 25));
    assert.equal(armed.style.left, "-1px");

    source.dispatchEvent(pointer("pointermove", 250, 25));
    assert.equal(armed.classList.contains("jolly-drag-zone-armed"), false);
    assert.equal(armed.style.left, "0px");

    source.dispatchEvent(pointer("pointerup", 250, 25));
  });
});
