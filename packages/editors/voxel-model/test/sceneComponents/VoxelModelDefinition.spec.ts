// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { Systems } from "@jolly-pixel/engine";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  ModelDocument,
  VOXEL_MODEL_KIND
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { VoxelModelDefinition } from "#src/sceneComponents/VoxelModelDefinition.ts";
import type { ModelView } from "#src/viewer/ModelView.ts";
import {
  VOXEL_MODEL_SOURCE,
  type VoxelModelSource
} from "#src/viewer/VoxelModelSource.ts";
import {
  makeActor,
  type FrameRequests
} from "../fixtures/engineActor.ts";

// CONSTANTS
const kModelReference: AssetReferenceData = {
  id: "model-1",
  kind: VOXEL_MODEL_KIND
};
const kTextureSize = { x: 64, y: 64 };

function makeModelSource() {
  const probe = {
    attached: [] as ModelView[],
    detached: [] as ModelView[],
    source: {
      document: new ModelDocument(),
      texture: {
        map: new THREE.Texture(),
        size: () => kTextureSize
      },
      attach: (view: ModelView) => {
        probe.attached.push(view);

        return () => void probe.detached.push(view);
      }
    } satisfies VoxelModelSource
  };

  return probe;
}

function createModel(
  source: VoxelModelSource | null,
  data: Systems.JSONObject = {},
  frames?: FrameRequests
) {
  const definition = new VoxelModelDefinition();
  const actor = makeActor(frames);
  const renderer = definition.create(
    actor,
    definition.parse(data),
    {
      mode: "edit",
      assets: new Systems.ComponentAssets(
        definition.assets,
        { model: source === null ? null : kModelReference },
        {
          resolve: <TValue>(): TValue => source as TValue
        }
      )
    }
  );

  return { actor, definition, renderer };
}

describe("VoxelModelDefinition", () => {
  it("serves voxel models to the VoxelModel component slot", () => {
    assert.equal(VOXEL_MODEL_SOURCE.kind.value, VOXEL_MODEL_KIND);
  });

  it("parses missing or invalid fields to their defaults", () => {
    const definition = new VoxelModelDefinition();

    assert.deepEqual(
      definition.parse({ castShadow: "yes" }),
      { castShadow: false, receiveShadow: false }
    );
  });

  it("builds nothing until a model is picked", () => {
    const { renderer } = createModel(null);

    assert.equal(renderer, null);
  });

  it("draws the picked model under the actor and lets it go on destroy", () => {
    const probe = makeModelSource();
    const frames = { invalidations: 0 };
    const { actor, renderer } = createModel(probe.source, {}, frames);
    assert.ok(renderer);

    renderer.awake();
    frames.invalidations = 0;
    probe.source.document.addBlock({ name: "Body" });

    assert.deepEqual(probe.attached, [renderer.view]);
    assert.equal(renderer.view.root.parent, actor.object3D);
    assert.equal(frames.invalidations, 1);

    renderer.destroy();

    assert.deepEqual(probe.detached, [renderer.view]);
    assert.equal(renderer.view.root.parent, null);
  });

  it("captures the settings it was given and applies edits", () => {
    const { definition, renderer } = createModel(
      makeModelSource().source,
      { castShadow: true }
    );
    assert.ok(renderer);

    assert.deepEqual(
      definition.capture(renderer),
      { castShadow: true, receiveShadow: false }
    );

    definition.apply(renderer, { castShadow: false, receiveShadow: true });

    assert.deepEqual(
      definition.parse(definition.capture(renderer)),
      { castShadow: false, receiveShadow: true }
    );
  });
});
