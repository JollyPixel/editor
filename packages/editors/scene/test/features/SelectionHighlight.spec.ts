// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import {
  ActorComponent,
  Systems,
  type Actor
} from "@jolly-pixel/engine";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { SelectionHighlight } from "../../src/features/viewport/SelectionHighlight.ts";
import { PresenceStore } from "../../src/state/PresenceStore.ts";
import { SelectionStore } from "../../src/state/SelectionStore.ts";
import { createSceneBinding } from "../helpers/sceneBinding.ts";

class BoxProbe extends ActorComponent {
  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "BoxProbe" });
    actor.object3D.add(new THREE.Mesh(new THREE.BoxGeometry()));
  }
}

// CONSTANTS
const kPeer: PresencePeer = {
  clientId: "peer-1",
  displayName: "Ada",
  color: "#43aa8b"
};
const kBox: Systems.ComponentDefinition<null, BoxProbe> = {
  type: "Box",
  parse: () => null,
  create: (actor) => actor.addComponentAndGet(BoxProbe)
};

function createHighlight() {
  const document = new SceneDocument();
  const { world, binding } = createSceneBinding(
    document,
    new Systems.ComponentDefinitions().register(kBox)
  );
  const selection = new SelectionStore(document);
  const presence = new PresenceStore();
  presence.peers = [kPeer];
  function addActor(
    name: string
  ): string {
    return document.addActor({
      name,
      components: [{ id: `${name}-box`, type: "Box", data: {}, assets: {} }]
    })!;
  }

  world
    .createActor("highlight")
    .addComponent(SelectionHighlight, {
      renderer: {} as THREE.WebGPURenderer,
      camera: new THREE.PerspectiveCamera(),
      binding,
      selection,
      presence
    });

  function outlined(
    id: string
  ): boolean {
    return binding.actor(id)!.object3D.children.some(
      (child) => child instanceof THREE.LineSegments
    );
  }

  return { document, selection, presence, addActor, outlined };
}

describe("SelectionHighlight", () => {
  test("outlines every selected actor and drops the outline once deselected", () => {
    const { selection, addActor, outlined } = createHighlight();
    const first = addActor("First");
    const second = addActor("Second");
    const third = addActor("Third");

    selection.select([first, second]);

    assert.deepEqual([outlined(first), outlined(second), outlined(third)], [true, true, false]);
    selection.select([]);
    assert.deepEqual([outlined(first), outlined(second)], [false, false]);
  });

  test("outlines the actor a peer selects", () => {
    const { presence, addActor, outlined } = createHighlight();
    const id = addActor("Shared");

    presence.selections = new Map([[id, [kPeer]]]);

    assert.strictEqual(outlined(id), true);
  });

  test("outlines a selected actor again once a reload rebuilds it", () => {
    const { document, selection, addActor, outlined } = createHighlight();
    const id = addActor("Kept");
    selection.select([id]);

    document.load({
      environment: document.tree.environment,
      actors: [document.tree.actor(id)!]
    });

    assert.strictEqual(outlined(id), true);
  });
});
