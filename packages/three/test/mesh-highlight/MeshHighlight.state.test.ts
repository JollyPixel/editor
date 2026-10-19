// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { MeshHighlightChangeEventDetail } from "#src/index.ts";
import { createHarness } from "./helpers.ts";

function createRegisteredHarness() {
  const harness = createHarness();
  harness.highlight.register("box", new THREE.Mesh());
  harness.highlight.register("cone", new THREE.Mesh());

  return harness;
}

function recordChanges(
  harness: ReturnType<typeof createHarness>
): MeshHighlightChangeEventDetail[] {
  const changes: MeshHighlightChangeEventDetail[] = [];
  harness.highlight.addEventListener("change", ({ detail }) => changes.push(detail));

  return changes;
}

describe("select and hover", () => {
  for (const action of ["select", "hover"] as const) {
    test(`${action} rejects an unregistered id and keeps the current one`, () => {
      const harness = createRegisteredHarness();
      const { highlight } = harness;
      highlight[action]("box");
      const changes = recordChanges(harness);

      assert.throws(() => highlight[action]("missing"), /no object registered for id "missing"/);

      assert.strictEqual(action === "select" ? highlight.selected : highlight.hovered, "box");
      assert.deepStrictEqual(changes, []);
    });
  }

  test("re-selecting the same id dispatches nothing", () => {
    const harness = createRegisteredHarness();
    harness.highlight.select("box");
    const changes = recordChanges(harness);

    harness.highlight.select("box");

    assert.deepStrictEqual(changes, []);
  });

  test("reports both the previous and the next id", () => {
    const harness = createRegisteredHarness();
    harness.highlight.hover("box");
    const changes = recordChanges(harness);

    harness.highlight.hover("cone");

    assert.deepStrictEqual(changes, [{ kind: "hover", objectIds: ["box", "cone"] }]);
  });
});

describe("emphasize", () => {
  test("reports the ids entering or leaving the group, and clears with an empty list", () => {
    const harness = createRegisteredHarness();
    const changes = recordChanges(harness);

    harness.highlight.emphasize(["box", "cone"]);
    harness.highlight.emphasize(["cone"]);
    harness.highlight.emphasize([]);

    assert.strictEqual(harness.highlight.emphasized.size, 0);
    assert.deepStrictEqual(changes.map(({ objectIds }) => objectIds), [
      ["box", "cone"],
      ["box"],
      ["cone"]
    ]);
  });

  test("throws for an unknown id without changing the group, and ignores a repeat", () => {
    const harness = createRegisteredHarness();
    harness.highlight.emphasize(["box"]);
    const changes = recordChanges(harness);

    assert.throws(() => harness.highlight.emphasize(["box", "missing"]));
    harness.highlight.emphasize(["box"]);

    assert.deepStrictEqual([...harness.highlight.emphasized], ["box"]);
    assert.deepStrictEqual(changes, []);
  });
});

describe("register and unregister", () => {
  test("unregister clears every local mark on the id before forgetting it", () => {
    const harness = createRegisteredHarness();
    const { highlight, presentations } = harness;
    highlight.select("box");
    highlight.hover("box");
    highlight.emphasize(["box", "cone"]);
    const changes = recordChanges(harness);

    highlight.unregister("box");

    assert.deepStrictEqual(changes.map(({ kind }) => kind), ["selection", "hover", "emphasis", "targets"]);
    assert.deepStrictEqual([...highlight.emphasized], ["cone"]);
    assert.deepStrictEqual(presentations[0].latest.map(({ objectId }) => objectId), ["cone"]);
    assert.throws(() => highlight.select("box"));
  });

  test("re-registering an id points its indicator at the new target", () => {
    const { highlight, presentations } = createRegisteredHarness();
    const replacement = new THREE.Mesh();
    highlight.select("box");

    highlight.register("box", replacement);

    assert.strictEqual(presentations[0].latest[0].target, replacement);
  });

  test("an unregistered peer mark resolves to nothing", () => {
    const { highlight, presentations } = createRegisteredHarness();

    highlight.peers.select("peer-a", "missing");

    assert.deepStrictEqual(presentations[0].latest, []);
  });
});
