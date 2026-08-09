// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerCursorOverlay
} from "#src/rendering/overlays/PeerCursorOverlay.ts";
import { Zoom } from "#src/rendering/Zoom.ts";
import {
  makeSvg,
  makeViewport
} from "../../helpers/overlay.ts";
import type { DefaultViewport } from "#src/rendering/Viewport.ts";
import type { Vec2 } from "#src/types.ts";

type MutableViewport = DefaultViewport & { camera: Vec2; };

function makeMutableViewport(): MutableViewport {
  return {
    zoom: new Zoom({
      default: 4
    }),
    camera: {
      x: 0,
      y: 0
    }
  };
}

describe("PeerCursorOverlay — set", () => {
  test("renders a visible arrow+label at the texture position, zoom 4 camera (0,0)", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    overlay.set(
      "peer-A",
      {
        pos: { x: 2, y: 3 },
        color: "#ff0000",
        label: "Alice"
      }
    );

    const group = svg.querySelector("g")!;
    assert.strictEqual(
      group.getAttribute("visibility"),
      "visible"
    );
    assert.strictEqual(
      group.getAttribute("transform"),
      "translate(8, 12)"
    );
    assert.strictEqual(
      svg.querySelector("path")!.getAttribute("fill"),
      "#ff0000"
    );
    const text = svg.querySelector("text")!;
    assert.strictEqual(
      text.getAttribute("fill"),
      "#ff0000"
    );
    assert.strictEqual(
      text.textContent,
      "Alice"
    );
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "no background pill"
    );
  });

  test("renders an empty label when none is given", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    overlay.set(
      "peer-A",
      {
        pos: { x: 0, y: 0 },
        color: "#ff0000"
      }
    );

    assert.strictEqual(
      svg.querySelector("text")!.textContent,
      ""
    );
  });

  test("a null pos hides the whole marker instead of removing it", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    overlay.set(
      "peer-A",
      {
        pos: { x: 0, y: 0 },
        color: "#ff0000"
      }
    );
    overlay.set(
      "peer-A",
      {
        pos: null,
        color: "#ff0000"
      }
    );

    assert.strictEqual(
      svg.querySelectorAll("g").length,
      1
    );
    assert.strictEqual(
      svg.querySelector("g")!.getAttribute("visibility"),
      "hidden"
    );
  });

  test("tracks multiple peers independently", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    overlay.set(
      "peer-A",
      {
        pos: { x: 0, y: 0 },
        color: "#ff0000"
      }
    );
    overlay.set(
      "peer-B",
      {
        pos: { x: 1, y: 1 },
        color: "#00ff00"
      }
    );

    assert.strictEqual(
      svg.querySelectorAll("path").length,
      2
    );
  });
});

describe("PeerCursorOverlay — remove", () => {
  test("removes the peer's group from the svg", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    overlay.set(
      "peer-A",
      {
        pos: { x: 0, y: 0 },
        color: "#ff0000"
      }
    );
    overlay.remove("peer-A");

    assert.strictEqual(
      svg.querySelectorAll("path").length,
      0
    );
  });

  test("removing an unknown peer is a no-op", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    assert.doesNotThrow(
      () => overlay.remove("nobody")
    );
  });
});

describe("PeerCursorOverlay — refresh", () => {
  test("re-projects the stored position against a changed camera", () => {
    const svg = makeSvg();
    const viewport = makeMutableViewport();
    const overlay = new PeerCursorOverlay(
      svg,
      viewport
    );

    overlay.set(
      "peer-A",
      {
        pos: { x: 2, y: 3 },
        color: "#ff0000"
      }
    );
    assert.strictEqual(
      svg.querySelector("g")!.getAttribute("transform"),
      "translate(8, 12)"
    );

    viewport.camera.x = 5;
    viewport.camera.y = -2;
    overlay.refresh();

    assert.strictEqual(
      svg.querySelector("g")!.getAttribute("transform"),
      "translate(13, 10)"
    );
  });
});

describe("PeerCursorOverlay — destroy", () => {
  test("removes every tracked peer's group", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    overlay.set(
      "peer-A",
      {
        pos: { x: 0, y: 0 },
        color: "#ff0000"
      }
    );
    overlay.set(
      "peer-B",
      {
        pos: { x: 1, y: 1 },
        color: "#00ff00"
      }
    );
    overlay.destroy();

    assert.strictEqual(svg.querySelectorAll("path").length, 0);
  });

  test("removes the shadow filter's <defs>", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    overlay.destroy();

    assert.strictEqual(
      svg.querySelectorAll("defs").length,
      0
    );
  });
});

describe("PeerCursorOverlay — drop shadow", () => {
  test("defines a feDropShadow filter and applies it to every peer's group", () => {
    const svg = makeSvg();
    const overlay = new PeerCursorOverlay(
      svg,
      makeViewport()
    );

    const filter = svg.querySelector("filter")!;
    assert.ok(filter, "a <filter> should be defined");
    assert.ok(
      filter.querySelector("feDropShadow"),
      "filter should contain a feDropShadow"
    );

    overlay.set(
      "peer-A",
      {
        pos: { x: 0, y: 0 },
        color: "#ff0000"
      }
    );

    const filterId = filter.getAttribute("id");
    const group = svg.querySelector("g")!;
    assert.strictEqual(
      group.getAttribute("filter"),
      `url(#${filterId})`
    );
  });

  test("two overlays sharing a page get distinct filter ids", () => {
    const svgA = makeSvg();
    const svgB = makeSvg();
    new PeerCursorOverlay(
      svgA,
      makeViewport()
    );
    new PeerCursorOverlay(
      svgB,
      makeViewport()
    );

    const idA = svgA.querySelector("filter")!.getAttribute("id");
    const idB = svgB.querySelector("filter")!.getAttribute("id");
    assert.notStrictEqual(idA, idB);
  });
});
