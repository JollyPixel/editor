// Import Node.js Dependencies
import assert from "node:assert";
import { afterEach, describe, it } from "node:test";

// Import Internal Dependencies
import { ColorSwatchPortal } from "../../../src/ui/color/ColorSwatchPortal.ts";

describe("ColorSwatchPortal", () => {
  let portal: ColorSwatchPortal | null = null;

  afterEach(() => {
    portal?.destroy();
    portal = null;
  });

  it("should append its element to document.body, hidden by default", () => {
    const anchor = document.createElement("button");
    portal = new ColorSwatchPortal({ anchor, onDismiss: () => void 0 });

    assert.strictEqual(portal.element.parentElement, document.body);
    assert.strictEqual(portal.element.style.display, "none");
  });

  it("should toggle display on open/close", () => {
    const anchor = document.createElement("button");
    portal = new ColorSwatchPortal({ anchor, onDismiss: () => void 0 });

    portal.open();
    assert.strictEqual(portal.element.style.display, "");

    portal.close();
    assert.strictEqual(portal.element.style.display, "none");
  });

  it("should call onDismiss on an outside click while open", () => {
    let dismissed = 0;
    const anchor = document.createElement("button");
    portal = new ColorSwatchPortal({ anchor, onDismiss: () => dismissed++ });

    portal.open();
    document.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    assert.strictEqual(dismissed, 1);
  });

  it("should not call onDismiss for a click while closed", () => {
    let dismissed = 0;
    const anchor = document.createElement("button");
    portal = new ColorSwatchPortal({ anchor, onDismiss: () => dismissed++ });

    document.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    assert.strictEqual(dismissed, 0);
  });

  it("should not call onDismiss for a click on the anchor or the portal itself", () => {
    let dismissed = 0;
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    portal = new ColorSwatchPortal({ anchor, onDismiss: () => dismissed++ });

    portal.open();
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    portal.element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    assert.strictEqual(dismissed, 0);
    anchor.remove();
  });

  it("should call onDismiss on Escape while open, not otherwise", () => {
    let dismissed = 0;
    const anchor = document.createElement("button");
    portal = new ColorSwatchPortal({ anchor, onDismiss: () => dismissed++ });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    assert.strictEqual(dismissed, 0, "closed portal should ignore Escape");

    portal.open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    assert.strictEqual(dismissed, 1);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    assert.strictEqual(dismissed, 1, "non-Escape keys are ignored");
  });

  it("should remove its element and stop listening once destroyed", () => {
    let dismissed = 0;
    const anchor = document.createElement("button");
    const instance = new ColorSwatchPortal({ anchor, onDismiss: () => dismissed++ });

    instance.open();
    instance.destroy();

    assert.strictEqual(instance.element.parentElement, null);

    document.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    assert.strictEqual(dismissed, 0);
  });
});
