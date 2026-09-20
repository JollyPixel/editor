// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  type ResolvedHighlightIndicator,
  type MeshHighlightAppearance,
  type MeshHighlightRenderer,
  type MeshHighlightRendererContext,
  type MeshHighlightChangeEventDetail,
  MeshHighlight
} from "#src/index.ts";

class TestHighlightRenderer implements MeshHighlightRenderer {
  snapshots: Array<readonly ResolvedHighlightIndicator[]> = [];
  appearances: MeshHighlightAppearance[] = [];
  renderCount = 0;
  disposeCount = 0;
  failSync = false;

  sync(
    indicators: readonly ResolvedHighlightIndicator[],
    appearance: MeshHighlightAppearance
  ): void {
    if (this.failSync) {
      throw new Error("sync failed");
    }
    this.snapshots.push(indicators);
    this.appearances.push(appearance);
  }

  render(): void {
    this.renderCount += 1;
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

function createHarness(): {
  system: MeshHighlight;
  contexts: MeshHighlightRendererContext[];
  presentations: TestHighlightRenderer[];
} {
  const contexts: MeshHighlightRendererContext[] = [];
  const presentations: TestHighlightRenderer[] = [];
  const renderer = {
    render: () => void 0
  } as unknown as THREE.WebGPURenderer;
  const system = new MeshHighlight({
    renderer,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    visibility: false,
    rendererFactory: (context) => {
      const presentation = new TestHighlightRenderer();
      contexts.push(context);
      presentations.push(presentation);

      return presentation;
    }
  });

  return { system, contexts, presentations };
}

describe("MeshHighlight", () => {
  test("owns state resolution and rendering behind one API", () => {
    const { system, presentations } = createHarness();
    const mesh = new THREE.Mesh();

    system.register("mesh", mesh);
    system.select("mesh");
    system.render();

    const active = presentations[0];
    const latest = active.snapshots.at(-1)!;
    assert.strictEqual(system.selected, "mesh");
    assert.strictEqual(latest.length, 1);
    assert.strictEqual(latest[0].target, mesh);
    assert.strictEqual(latest[0].source, "local");
    assert.strictEqual(active.renderCount, 1);
  });

  test("peer changes use the same resolver and active renderer", () => {
    const { system, presentations } = createHarness();
    system.register("mesh", new THREE.Mesh());

    system.peerSelections.select("peer-a", "mesh");

    const [indicator] = presentations[0].snapshots.at(-1)!;
    assert.strictEqual(indicator.source, "peer");
    assert.strictEqual(indicator.peerId, "peer-a");
  });

  test("forwards local and peer changes from the facade", () => {
    const { system } = createHarness();
    const changes: MeshHighlightChangeEventDetail[] = [];
    system.addEventListener("change", ({ detail }) => changes.push(detail));

    system.register("mesh", new THREE.Mesh());
    system.select("mesh");
    system.peerSelections.select("peer-a", "mesh");

    assert.deepStrictEqual(
      changes.map(({ kind }) => kind),
      ["targets", "selection", "peers"]
    );
    assert.deepStrictEqual(changes[1].objectIds, ["mesh"]);
  });

  test("mode replaces and disposes the renderer without losing state", () => {
    const { system, contexts, presentations } = createHarness();
    system.register("mesh", new THREE.Mesh());
    system.select("mesh");

    system.mode = "highlight";

    assert.strictEqual(system.mode, "highlight");
    assert.strictEqual(system.state.technique, "highlight");
    assert.strictEqual(contexts.at(-1)!.mode, "highlight");
    assert.strictEqual(presentations[0].disposeCount, 1);
    assert.strictEqual(
      presentations[1].snapshots.at(-1)![0].objectId,
      "mesh"
    );
  });

  test("configure swaps renderer configuration atomically", () => {
    const { system, contexts, presentations } = createHarness();

    system.configure({
      selected: {
        color: "#ff0000"
      },
      highlight: {
        edgeThickness: 4
      }
    });

    assert.strictEqual(system.appearance.selected.color, "#ff0000");
    assert.strictEqual(system.appearance.highlight.edgeThickness, 4);
    assert.strictEqual(contexts.at(-1)!.appearance, system.appearance);
    assert.strictEqual(presentations[0].disposeCount, 1);
  });

  test("a failed mode synchronization leaves the old renderer active", () => {
    const { system, presentations } = createHarness();
    system.register("mesh", new THREE.Mesh());
    system.select("mesh");

    const previous = presentations[0];
    assert.strictEqual(presentations.length, 1);

    /*
     * The second renderer is created by the existing factory. Mark it as
     * failing immediately after construction through an appearance event.
     */
    system.state.addEventListener("techniqueChange", () => {
      presentations.at(-1)!.failSync = true;
    }, { once: true });

    assert.throws(() => {
      system.mode = "highlight";
    }, /sync failed/);
    assert.strictEqual(system.mode, "outline");
    assert.strictEqual(system.state.technique, "outline");
    assert.strictEqual(previous.disposeCount, 0);
    assert.strictEqual(presentations[1].disposeCount, 1);

    system.render();
    assert.strictEqual(previous.renderCount, 1);
  });

  test("dispose releases the active renderer and owned state", () => {
    const { system, presentations } = createHarness();
    system.register("mesh", new THREE.Mesh());
    system.peerSelections.select("peer-a", "mesh");

    system.dispose();
    system.dispose();

    assert.strictEqual(presentations[0].disposeCount, 1);
    assert.deepStrictEqual(system.peerSelections.selectedObjectIds(), []);
    assert.strictEqual(system.state.targetFor("mesh"), undefined);
    assert.throws(() => system.render(), /disposed/);
  });
});
