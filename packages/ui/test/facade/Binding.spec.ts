// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Binding } from "../../src/facade/Binding.ts";

/*
 * Lit elements carry decorators, which node type stripping cannot parse, so no
 * custom element is registered here. The facade still creates the right tag
 * and sets the right properties on it; how the element then behaves is covered
 * by the Playwright suite.
 */

function commit(
  element: HTMLElement,
  value: unknown
): void {
  element.dispatchEvent(
    new CustomEvent("jolly-change", {
      detail: { value }
    })
  );
}

describe("facade.Binding math values", () => {
  test("dispatches a three-axis property to jolly-vector3", () => {
    const object = { position: { x: 1, y: 2, z: 3 } };
    const binding = new Binding(object, "position");

    assert.equal(binding.element.localName, "jolly-vector3");
  });

  test("copies a commit onto the bound object, keeping its identity", () => {
    const position = { x: 0, y: 0, z: 0 };
    const object = { position };
    const binding = new Binding(object, "position");

    commit(binding.element, { x: 1, y: 2, z: 3 });

    assert.equal(object.position, position);
    assert.deepEqual(position, { x: 1, y: 2, z: 3 });
  });

  test("keeps a bound class instance and its methods", () => {
    class Vector {
      x = 0;
      y = 0;
      z = 0;
      lengthSq(): number {
        return (this.x ** 2) + (this.y ** 2) + (this.z ** 2);
      }
    }
    const object = { position: new Vector() };
    const binding = new Binding(object, "position");

    commit(binding.element, { x: 3, y: 0, z: 4 });

    assert.ok(object.position instanceof Vector);
    assert.equal(object.position.lengthSq(), 25);
  });

  test("hands the handler the bound property, not the event payload", () => {
    const position = { x: 0, y: 0, z: 0 };
    const object = { position };
    const seen: unknown[] = [];
    const binding = new Binding(object, "position");
    binding.on("change", ({ value }) => seen.push(value));

    commit(binding.element, { x: 1, y: 2, z: 3 });

    assert.deepEqual(seen, [position]);
  });

  test("refresh assigns a fresh record, never the bound object", () => {
    const position = { x: 1, y: 2, z: 3 };
    const object = { position };
    const binding = new Binding(object, "position");
    const field = binding.element as unknown as { value: unknown; };

    position.x = 9;
    binding.refresh();

    assert.notEqual(field.value, position);
    assert.deepEqual(field.value, { x: 9, y: 2, z: 3 });
  });

  test("reads a four-axis property as a rotation on request", () => {
    const object = { rotation: { x: 0, y: 0, z: 0, w: 1 } };
    const binding = new Binding(object, "rotation", { view: "quaternion" });

    assert.equal(binding.element.localName, "jolly-quaternion");
  });

  test("forwards bounds and axis labels to a vector field", () => {
    const object = { size: { x: 1, y: 1 } };
    const binding = new Binding(object, "size", {
      min: 1,
      max: 24,
      step: 1,
      axisLabels: { x: "width" }
    });
    const field = binding.element as unknown as {
      min: number;
      max: number;
      step: number;
      axisLabels: Record<string, string>;
    };

    assert.equal(field.min, 1);
    assert.equal(field.max, 24);
    assert.equal(field.step, 1);
    assert.deepEqual(field.axisLabels, { x: "width" });
  });
});

describe("facade.Binding color alpha", () => {
  test("turns the alpha channel on for an eight-digit hex", () => {
    const object = { color: "#4da3ff80" };
    const binding = new Binding(object, "color");

    assert.equal(
      (binding.element as unknown as { alpha: boolean; }).alpha,
      true
    );
  });

  test("leaves it off for a six-digit hex", () => {
    const object = { color: "#4da3ff" };
    const binding = new Binding(object, "color");

    assert.equal(
      (binding.element as unknown as { alpha: boolean; }).alpha,
      false
    );
  });

  test("an explicit option wins over the value", () => {
    const object = { color: "#4da3ff" };
    const binding = new Binding(object, "color", { alpha: true });

    assert.equal(
      (binding.element as unknown as { alpha: boolean; }).alpha,
      true
    );
  });
});

describe("facade.Binding scalar values", () => {
  test("still replaces a bound number outright", () => {
    const object = { opacity: 0.5 };
    const binding = new Binding(object, "opacity");

    commit(binding.element, 0.75);

    assert.equal(object.opacity, 0.75);
  });
});
