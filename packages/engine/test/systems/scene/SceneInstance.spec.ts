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
  SceneInstance,
  type ComponentContext,
  type ComponentDefinition,
  type JSONObject,
  type SceneMode
} from "../../../src/systems/scene/file/index.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";
import { createSceneAssets } from "../../helpers/scene/sceneAssets.ts";
import {
  createActorFile,
  createComponentFile,
  createWarningLogger
} from "../../helpers/scene/sceneFile.ts";

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

function createInstance(
  mode: SceneMode
) {
  const { logger, warnings } = createWarningLogger();
  const { sm, world } = createSceneSetup(createSceneAssets(), logger);
  const resolved: AssetReferenceData[] = [];
  const instance = new SceneInstance({
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

  return { sm, instance, warnings, resolved };
}

describe("Systems.SceneInstance", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
  });

  test("builds actors in tree order with names, visibility and transforms", () => {
    const { sm, instance } = createInstance("play");

    instance.add([
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

    const root = instance.actor("root")!;
    const child = instance.actor("child")!;
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

  test("adds an actor later under a parent it already built", () => {
    const { instance } = createInstance("edit");
    instance.add([createActorFile("parent")]);

    instance.add([createActorFile("late", { parentId: "parent" })]);

    assert.strictEqual(instance.actor("late")!.parent, instance.actor("parent"));
  });

  test("writes the name, visibility and transform of a file to a built actor", () => {
    const { instance } = createInstance("edit");
    instance.add([createActorFile("root")]);

    instance.write("root", {
      name: "Renamed",
      visible: false,
      transform: {
        position: { x: 4, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    });

    const { object3D } = instance.actor("root")!;
    assert.strictEqual(object3D.name, "Renamed");
    assert.strictEqual(object3D.visible, false);
    assert.deepEqual(object3D.position.toArray(), [4, 0, 0]);
  });

  test("skips an actor whose parent was not built, with its subtree", () => {
    const { instance, warnings } = createInstance("play");

    instance.add([
      createActorFile("orphan", { parentId: "missing" }),
      createActorFile("grandchild", { parentId: "orphan" })
    ]);

    assert.strictEqual(instance.actor("orphan"), null);
    assert.strictEqual(instance.actor("grandchild"), null);
    assert.strictEqual(warnings().length, 2);
  });

  test("creates components from parsed data and maps them by file id", () => {
    const { instance } = createInstance("edit");
    const built: string[] = [];
    instance.on("componentBuilt", ({ id, actorId }) => built.push(`${actorId}/${id}`));

    instance.add([
      createActorFile("actor", {
        components: [
          createComponentFile("labelled", "Tag", { label: "sun" }),
          createComponentFile("invalid", "Tag", { label: 4 })
        ]
      })
    ]);

    const labelled = instance.component("labelled") as TagComponent;
    const invalid = instance.component("invalid") as TagComponent;
    assert.deepEqual(instance.actor("actor")!.components, [labelled, invalid]);
    assert.strictEqual(labelled.label, "sun");
    assert.strictEqual(invalid.label, "default");
    assert.strictEqual(labelled.componentContext.mode, "edit");
    assert.deepEqual(built, ["actor/labelled", "actor/invalid"]);
  });

  test("resolves a component's asset slots through the resolver", () => {
    const { instance, resolved } = createInstance("play");
    const map = { id: "map-1", kind: "texture" };

    instance.add([
      createActorFile("actor", {
        components: [createComponentFile("tag", "Tag", {}, { map, empty: null })]
      })
    ]);
    const { assets } = (instance.component("tag") as TagComponent).componentContext;

    assert.strictEqual(assets.resolve("map"), "value:map-1");
    assert.strictEqual(assets.resolve("empty"), null);
    assert.strictEqual(assets.resolve("absent"), null);
    assert.deepEqual(resolved, [map]);
  });

  test("skips unknown component types with a warning in play mode only", () => {
    const play = createInstance("play");
    const edit = createInstance("edit");
    const actors = [
      createActorFile("actor", {
        components: [createComponentFile("unknown", "Particles")]
      })
    ];

    play.instance.add(actors);
    edit.instance.add(actors);

    assert.strictEqual(play.instance.component("unknown"), null);
    assert.strictEqual(edit.instance.component("unknown"), null);
    assert.deepEqual(play.instance.actor("actor")!.components, []);
    assert.strictEqual(play.warnings().length, 1);
    assert.strictEqual(edit.warnings().length, 0);
  });

  test("forgets a removed actor's subtree and drops its components", () => {
    const { sm, instance } = createInstance("edit");
    instance.add([
      createActorFile("kept"),
      createActorFile("parent"),
      createActorFile("child", {
        parentId: "parent",
        components: [createComponentFile("tag", "Tag")]
      })
    ]);
    const tag = instance.component("tag");
    const dropped: unknown[] = [];
    instance.on("componentDropped", (component) => dropped.push(component));

    instance.remove("parent");

    assert.strictEqual(instance.actor("child"), null);
    assert.strictEqual(instance.component("tag"), null);
    assert.deepEqual(dropped, [tag]);
    assert.deepEqual(sm.tree.children, [instance.actor("kept")]);
  });

  test("rebuilds a component in place of the one with the same id", () => {
    const { instance } = createInstance("edit");
    instance.add([
      createActorFile("actor", {
        components: [createComponentFile("tag", "Tag", { label: "old" })]
      })
    ]);
    const old = instance.component("tag")!;

    instance.rebuildComponent(
      "actor",
      createComponentFile("tag", "Tag", { label: "new" })
    );

    const rebuilt = instance.component("tag") as TagComponent;
    assert.strictEqual(rebuilt.label, "new");
    assert.deepEqual(instance.actor("actor")!.components, [rebuilt]);
    assert.strictEqual(old.pendingForDestruction, true);
  });

  test("destroys every actor it built when cleared", () => {
    const { sm, instance } = createInstance("edit");
    instance.add([
      createActorFile("root"),
      createActorFile("child", { parentId: "root" })
    ]);

    instance.clear();

    assert.deepEqual(sm.tree.children, []);
    assert.strictEqual(instance.actor("root"), null);
  });

  test("refuses to register two definitions of the same type", () => {
    const definitions = new ComponentDefinitions().register(kTagDefinition);

    assert.throws(
      () => definitions.register(kTagDefinition),
      /Component type "Tag" is already registered/
    );
  });
});
