// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { SvgManager } from "../src/SvgManager.ts";
import type { DefaultViewport } from "../src/types.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
});

function makeParent(): HTMLDivElement {
  // Use happy-dom's real document.body so parentElement tracking works correctly.
  const div = kEmulatedBrowserWindow.document.body.appendChild(
    kEmulatedBrowserWindow.document.createElement("div")
  ) as unknown as HTMLDivElement;
  (div as any).getBoundingClientRect = () => {
    return {
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200
    };
  };

  return div;
}

function makeViewport(): DefaultViewport {
  return {
    zoom: 4,
    camera: { x: 0, y: 0 }
  };
}

function makeBrush() {
  return {
    get size() {
      return 1;
    },
    get colorInline() {
      return "#FFF";
    },
    get colorOutline() {
      return "#000";
    }
  };
}

describe("SvgManager", () => {
  describe("destroy", () => {
    test("destroy() removes the SVG from parent", () => {
      const parent = makeParent();

      const svgMgr = new SvgManager({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        textureSize: { x: 16, y: 16 }
      });

      // Before destroy: parent should have child SVG elements
      const childrenBefore = parent.childElementCount;
      assert.ok(childrenBefore > 0, "parent should contain the SVG element after construction");

      svgMgr.destroy();

      const childrenAfter = parent.childElementCount;
      assert.strictEqual(childrenAfter, 0, "SVG element should be removed after destroy()");
    });

    test("destroy() can be called again without throwing", () => {
      const parent = makeParent();

      const svgMgr = new SvgManager({
        parent,
        viewport: makeViewport(),
        brush: makeBrush(),
        textureSize: { x: 8, y: 8 }
      });

      svgMgr.destroy();
      assert.doesNotThrow(() => svgMgr.destroy());
    });
  });
});
