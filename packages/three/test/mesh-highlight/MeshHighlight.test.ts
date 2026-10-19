// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { MeshHighlightChangeEventDetail } from "#src/index.ts";
import { createHarness } from "./helpers.ts";

describe("MeshHighlight", () => {
  test("owns state resolution and rendering behind one API", () => {
    const { highlight, presentations } = createHarness();
    const mesh = new THREE.Mesh();

    highlight.register("mesh", mesh);
    highlight.select("mesh");
    highlight.render();

    const [active] = presentations;
    assert.strictEqual(highlight.selected, "mesh");
    assert.strictEqual(active.latest.length, 1);
    assert.strictEqual(active.latest[0].target, mesh);
    assert.strictEqual(active.latest[0].source, "local");
    assert.strictEqual(active.renderCount, 1);
  });

  test("peer changes use the same resolver and active renderer", () => {
    const { highlight, presentations } = createHarness();
    highlight.register("mesh", new THREE.Mesh());

    highlight.peers.select("peer-a", "mesh");

    const [indicator] = presentations[0].latest;
    assert.strictEqual(indicator.source, "peer");
    assert.strictEqual(indicator.peerId, "peer-a");
  });

  test("forwards local and peer changes from the facade", () => {
    const { highlight } = createHarness();
    const changes: MeshHighlightChangeEventDetail[] = [];
    const peerChanges: MeshHighlightChangeEventDetail[] = [];
    highlight.addEventListener("change", ({ detail }) => changes.push(detail));
    highlight.addEventListener("peersChange", ({ detail }) => peerChanges.push(detail));

    highlight.register("mesh", new THREE.Mesh());
    highlight.select("mesh");
    highlight.peers.select("peer-a", "mesh");

    assert.deepStrictEqual(
      changes.map(({ kind }) => kind),
      ["targets", "selection", "peers"]
    );
    assert.deepStrictEqual(changes[1].objectIds, ["mesh"]);
    assert.deepStrictEqual(peerChanges, [{ kind: "peers", objectIds: ["mesh"] }]);
  });

  test("mode replaces and disposes the renderer without losing state", () => {
    const { highlight, contexts, presentations } = createHarness();
    highlight.register("mesh", new THREE.Mesh());
    highlight.register("custom", new THREE.Mesh(), { technique: "silhouette" });
    highlight.select("mesh");
    highlight.hover("custom");

    highlight.mode = "highlight";

    assert.strictEqual(highlight.mode, "highlight");
    assert.strictEqual(contexts.at(-1)!.mode, "highlight");
    assert.strictEqual(presentations[0].disposeCount, 1);
    assert.deepStrictEqual(
      presentations[1].latest.map(({ objectId, technique }) => {
        return { objectId, technique };
      }),
      [
        { objectId: "mesh", technique: "highlight" },
        { objectId: "custom", technique: "silhouette" }
      ]
    );
  });

  test("configure re-syncs the active renderer without rebuilding it", () => {
    const { highlight, contexts, presentations } = createHarness();
    const appearances: string[] = [];
    highlight.addEventListener("appearanceChange", ({ detail }) => appearances.push(detail.kind));

    highlight.configure({
      selected: {
        color: "#ff0000"
      },
      highlight: {
        edgeThickness: 4
      }
    });

    assert.strictEqual(highlight.appearance.selected.color, "#ff0000");
    assert.strictEqual(highlight.appearance.highlight.edgeThickness, 4);
    assert.strictEqual(contexts.length, 1);
    assert.strictEqual(presentations[0].disposeCount, 0);
    assert.strictEqual(presentations[0].appearances.at(-1), highlight.appearance);
    assert.deepStrictEqual(appearances, ["appearance"]);
  });

  test("a failed mode synchronization leaves the old renderer active", () => {
    const { highlight, presentations } = createHarness({ failingModes: ["highlight"] });
    highlight.register("mesh", new THREE.Mesh());
    highlight.select("mesh");
    const [previous] = presentations;

    assert.throws(() => {
      highlight.mode = "highlight";
    }, /sync failed/);
    assert.strictEqual(highlight.mode, "outline");
    assert.strictEqual(previous.disposeCount, 0);
    assert.strictEqual(presentations[1].disposeCount, 1);

    highlight.render();
    assert.strictEqual(previous.renderCount, 1);
  });

  test("a failed configure synchronization keeps the old appearance", () => {
    const { highlight, presentations } = createHarness();
    highlight.register("mesh", new THREE.Mesh());
    highlight.select("mesh");
    const appearance = highlight.appearance;
    presentations[0].failSync = true;

    assert.throws(() => {
      highlight.configure({
        selected: {
          color: "#ff0000"
        }
      });
    }, /sync failed/);
    assert.strictEqual(highlight.appearance, appearance);
    assert.strictEqual(presentations[0].disposeCount, 0);
  });

  test("dispose releases the active renderer and owned state", () => {
    const { highlight, presentations } = createHarness();
    highlight.register("mesh", new THREE.Mesh());
    highlight.select("mesh");
    highlight.peers.select("peer-a", "mesh");

    highlight.dispose();
    highlight.dispose();

    assert.strictEqual(presentations[0].disposeCount, 1);
    assert.deepStrictEqual(highlight.peers.selectedObjectIds(), []);
    assert.strictEqual(highlight.selected, null);
    assert.throws(() => highlight.render(), /disposed/);
  });
});
