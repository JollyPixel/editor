// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Import Internal Dependencies
import { PeerSelectionHighlight } from "../../src/collaboration/PeerSelectionHighlight.ts";
import { PresenceStore } from "../../src/app/state/index.ts";
import ModelManager from "../../src/features/groups/ModelManager.ts";
import type { PeerMark } from "../../src/collaboration/peerMarks.ts";

function createModelManager(): ModelManager {
  const scene = new THREE.Scene();
  const transformControl = {
    attach: () => undefined,
    detach: () => undefined,
    getHelper: () => new THREE.Object3D()
  } as unknown as TransformControls;

  return new ModelManager({ scene, transformControl });
}

function createFakeActor(): Actor {
  return {
    components: [],
    componentsRequiringUpdate: [],
    world: {
      sceneManager: {
        componentsToBeStarted: []
      }
    }
  } as unknown as Actor;
}

function mark(
  clientId: string,
  color: string
): PeerMark {
  return { clientId, displayName: clientId, color };
}

function createHarness() {
  const modelManager = createModelManager();
  const presence = new PresenceStore();
  const highlight = new PeerSelectionHighlight(createFakeActor(), {
    modelManager,
    presence
  });

  return { modelManager, presence, highlight };
}

function findEmphasisShell(
  modelManager: ModelManager,
  uuid: string
): THREE.Mesh | undefined {
  return modelManager.getGroupByUUID(uuid)?.getMesh().children
    .find((child) => child.name === "emphasis-shell") as THREE.Mesh | undefined;
}

describe("PeerSelectionHighlight", () => {
  test("emphasizes the block a peer has selected", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    harness.presence.blockSelections = new Map([
      [group.getGroupUUID(), [mark("bob", "#112233")]]
    ]);

    const shell = findEmphasisShell(harness.modelManager, group.getGroupUUID());
    assert.ok(shell);
    assert.equal((shell.material as THREE.MeshBasicMaterial).color.getHexString(), "112233");
    harness.highlight.destroy();
  });

  test("clears the glow once the peer deselects", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    harness.presence.blockSelections = new Map([
      [group.getGroupUUID(), [mark("bob", "#112233")]]
    ]);
    harness.presence.blockSelections = new Map();

    assert.equal(findEmphasisShell(harness.modelManager, group.getGroupUUID()), undefined);
    harness.highlight.destroy();
  });

  test("moves the glow when the peer selects a different block", () => {
    const harness = createHarness();
    const first = harness.modelManager.addGroup();
    const second = harness.modelManager.addGroup();

    harness.presence.blockSelections = new Map([
      [first.getGroupUUID(), [mark("bob", "#112233")]]
    ]);
    harness.presence.blockSelections = new Map([
      [second.getGroupUUID(), [mark("bob", "#112233")]]
    ]);

    assert.equal(findEmphasisShell(harness.modelManager, first.getGroupUUID()), undefined);
    assert.ok(findEmphasisShell(harness.modelManager, second.getGroupUUID()));
    harness.highlight.destroy();
  });

  test("keeps the glow lit for the remaining peer when one of two deselects", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    harness.presence.blockSelections = new Map([
      [group.getGroupUUID(), [mark("bob", "#ff0000"), mark("cleo", "#0000ff")]]
    ]);
    harness.presence.blockSelections = new Map([
      [group.getGroupUUID(), [mark("bob", "#ff0000")]]
    ]);

    const shell = findEmphasisShell(harness.modelManager, group.getGroupUUID());
    assert.ok(shell);
    assert.equal((shell.material as THREE.MeshBasicMaterial).color.getHexString(), "ff0000");
    harness.highlight.destroy();
  });

  test("clears every tracked glow on destroy", () => {
    const harness = createHarness();
    const group = harness.modelManager.addGroup();

    harness.presence.blockSelections = new Map([
      [group.getGroupUUID(), [mark("bob", "#112233")]]
    ]);
    harness.highlight.destroy();

    assert.equal(findEmphasisShell(harness.modelManager, group.getGroupUUID()), undefined);
  });
});
