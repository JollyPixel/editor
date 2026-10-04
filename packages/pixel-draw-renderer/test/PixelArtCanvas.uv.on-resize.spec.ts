// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { stubRect } from "./helpers/dom.ts";

describe("PixelArtCanvas — onResize (SVG overlay refresh, regression)", () => {
  test("the UV overlay follows the camera shift caused by a container resize", () => {
    const {
      manager,
      container,
      overlay: svg
    } = createPixelArtCanvas({
      zoom: { default: 4 }
    });

    manager.uv.create({ width: 4, height: 4 });
    manager.uv.showAll = true;

    const uvRegionBorder = svg.querySelector("g:not([visibility]) > rect:last-child")!;
    assert.strictEqual(uvRegionBorder.getAttribute("x"), "84");
    assert.strictEqual(uvRegionBorder.getAttribute("y"), "84");

    stubRect(container, {
      width: 300,
      height: 300
    });
    manager.onResize();

    assert.strictEqual(
      uvRegionBorder.getAttribute("x"),
      "134",
      "the overlay must follow the camera shift from resizeCanvas"
    );
    assert.strictEqual(
      uvRegionBorder.getAttribute("y"),
      "134",
      "the overlay must follow the camera shift from resizeCanvas"
    );
    manager.destroy();
  });

  test("the select overlay follows the camera shift caused by a container resize", () => {
    const {
      manager,
      container,
      overlay: svg
    } = createPixelArtCanvas({
      zoom: { default: 4 }
    });

    manager.mode = "select";
    const canvas = manager.canvas();
    canvas.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 92,
        clientY: 92,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        buttons: 1,
        clientX: 96,
        clientY: 96,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true
      })
    );

    const selectionOutline = [...svg.querySelectorAll(":scope > rect")]
      .find((el) => el.getAttribute("visibility") === "visible")!;
    assert.strictEqual(selectionOutline.getAttribute("x"), "92");

    stubRect(container, {
      width: 300,
      height: 300
    });
    manager.onResize();

    assert.strictEqual(
      selectionOutline.getAttribute("x"),
      "142",
      "the selection outline must follow the camera shift from resizeCanvas"
    );
    manager.destroy();
  });
});
