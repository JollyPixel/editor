// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  AssetType,
  type AssetReferenceData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { ActorComponent } from "../../../src/actor/ActorComponent.ts";
import {
  ComponentDefinitions,
  SceneBuilder,
  type ComponentContext,
  type ComponentDefinition,
  type JSONObject,
  type SceneMode
} from "../../../src/systems/scene/file/index.ts";
import { createSceneSetup } from "../../helpers/sceneSetup.ts";
import { createSceneAssets } from "../../sceneAssets.ts";
import {
  createActorFile,
  createComponentFile,
  createWarningLogger
} from "../../helpers/sceneFile.ts";

// CONSTANTS
const kTextureType = new AssetType<string>("texture");

class TagComponent extends ActorComponent {
  readonly label: string;
  readonly componentContext: ComponentContext;

  constructor(
    actor: Actor,
    options: { label: string; context: ComponentContext; }
  ) {
    super({ actor, typeName: "Tag" });
    this.label = options.label;
    this.componentContext = options.context;
  }
}

const kTagDefinition: ComponentDefinition<string, TagComponent> = {
  type: "Tag",
  assets: { map: kTextureType, empty: kTextureType, absent: kTextureType },
  parse: (data: Readonly<JSONObject>) => (typeof data.label === "string" ? data.label : "default"),
  create: (actor, label, context) => actor.addComponentAndGet(TagComponent, { label, context })
};

function createBuilder(
  mode: SceneMode
) {
  const { logger, warnings } = createWarningLogger();
  const { sm, world } = createSceneSetup(createSceneAssets(), logger);
  const resolved: AssetReferenceData[] = [];
  const builder = new SceneBuilder({
    world: world as any,
    mode,
    components: new ComponentDefinitions().register(kTagDefinition),
    assets: {
      resolve: (reference, _type) => {
        resolved.push(reference);

        return `value:${reference.id}` as never;
      }
    }
  });

  return { sm, builder, warnings, resolved };
}

describe("Systems.SceneBuilder", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
  });

  test("builds actors in tree order with names, visibility and transforms", () => {
    const { sm, builder } = createBuilder("play");

    const build = builder.build([
      createActorFile("root", {
        name: "Root",
        transform: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0, y: 90, z: 0 },
          scale: { x: 2, y: 2, z: 2 }
        }
      }),
      createActorFile("child", { name: "Child", parentId: "root", visible: false })
    ]);

    const root = build.actor("root")!;
    const child = build.actor("child")!;
    assert.deepEqual(sm.tree.children, [root]);
    assert.strictEqual(child.parent, root);
    assert.strictEqual(child.name, "Child");
    assert.strictEqual(child.object3D.visible, false);
    assert.deepEqual(root.object3D.position.toArray(), [1, 2, 3]);
    assert.ok(Math.abs(root.object3D.rotation.y - (Math.PI / 2)) < 1e-9);
    assert.deepEqual(root.object3D.scale.toArray(), [2, 2, 2]);
    assert.deepEqual(
      child.object3D.getWorldPosition(new THREE.Vector3()).toArray(),
      [1, 2, 3]
    );
  });

  test("builds root actors under the given parent", () => {
    const { builder } = createBuilder("play");
    const parent = builder.build([createActorFile("instance")]).actor("instance")!;

    const build = builder.build([createActorFile("inner")], parent);

    assert.strictEqual(build.actor("inner")!.parent, parent);
  });

  test("skips an actor whose parent was not built, with its subtree", () => {
    const { builder, warnings } = createBuilder("play");

    const build = builder.build([
      createActorFile("orphan", { parentId: "missing" }),
      createActorFile("grandchild", { parentId: "orphan" })
    ]);

    assert.strictEqual(build.actor("orphan"), null);
    assert.strictEqual(build.actor("grandchild"), null);
    assert.strictEqual(warnings().length, 2);
  });

  test("creates components from parsed data and maps them by file id", () => {
    const { builder } = createBuilder("edit");

    const build = builder.build([
      createActorFile("actor", {
        components: [
          createComponentFile("labelled", "Tag", { label: "sun" }),
          createComponentFile("invalid", "Tag", { label: 4 })
        ]
      })
    ]);

    const labelled = build.component("labelled") as TagComponent;
    const invalid = build.component("invalid") as TagComponent;
    assert.deepEqual(build.actor("actor")!.components, [labelled, invalid]);
    assert.strictEqual(labelled.label, "sun");
    assert.strictEqual(invalid.label, "default");
    assert.strictEqual(labelled.componentContext.mode, "edit");
  });

  test("resolves a component's asset slots through the resolver", () => {
    const { builder, resolved } = createBuilder("play");
    const map = { id: "map-1", kind: "texture" };

    const build = builder.build([
      createActorFile("actor", {
        components: [createComponentFile("tag", "Tag", {}, { map, empty: null })]
      })
    ]);
    const { assets } = (build.component("tag") as TagComponent).componentContext;

    assert.strictEqual(assets.resolve("map"), "value:map-1");
    assert.strictEqual(assets.resolve("empty"), null);
    assert.strictEqual(assets.resolve("absent"), null);
    assert.deepEqual(resolved, [map]);
  });

  test("skips unknown component types with a warning in play mode only", () => {
    const play = createBuilder("play");
    const edit = createBuilder("edit");
    const actors = [
      createActorFile("actor", {
        components: [createComponentFile("unknown", "Particles")]
      })
    ];

    const playBuild = play.builder.build(actors);
    const editBuild = edit.builder.build(actors);

    assert.strictEqual(playBuild.component("unknown"), null);
    assert.strictEqual(editBuild.component("unknown"), null);
    assert.deepEqual(playBuild.actor("actor")!.components, []);
    assert.strictEqual(play.warnings().length, 1);
    assert.strictEqual(edit.warnings().length, 0);
  });

  test("refuses to register two definitions of the same type", () => {
    const definitions = new ComponentDefinitions().register(kTagDefinition);

    assert.throws(
      () => definitions.register(kTagDefinition),
      /Component type "Tag" is already registered/
    );
  });
});
