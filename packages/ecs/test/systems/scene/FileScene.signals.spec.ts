// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { ActorComponent } from "../../../src/actor/ActorComponent.ts";
import { SignalEvent } from "../../../src/actor/Signal.ts";
import type { Logger } from "../../../src/systems/Logger.ts";
import { Scene } from "../../../src/systems/scene/Scene.ts";
import {
  ComponentDefinitions,
  FileScene,
  type ComponentDefinition,
  type SceneActorFile,
  type SceneConnectionFile,
  type ScenePrefabs
} from "../../../src/systems/scene/file/index.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";
import {
  createActorFile,
  createComponentFile,
  createSceneFile,
  createWarningLogger
} from "../../helpers/scene/sceneFile.ts";

class Lever extends ActorComponent {
  readonly pulled = new SignalEvent<[force: number]>();

  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "Lever" });
  }

  awake() {
    this.pulled.emit(1);
  }
}

class Door extends ActorComponent {
  readonly forces: number[] = [];

  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "Door" });
  }

  open(
    force: number
  ) {
    this.forces.push(force);
  }
}

function definition(
  type: string,
  component: typeof Lever | typeof Door
): ComponentDefinition<null> {
  return {
    type,
    parse: () => null,
    create: (actor) => actor.addComponentAndGet(component)
  };
}

function connection(
  overrides: Partial<SceneConnectionFile> = {}
): SceneConnectionFile {
  return {
    id: "c1",
    signal: "pulled",
    target: "door",
    method: "open",
    ...overrides
  };
}

function leverAndDoor(
  connections: SceneConnectionFile[]
): SceneActorFile[] {
  return [
    createActorFile("lever", {
      components: [{
        ...createComponentFile("lever", "Lever"),
        connections
      }]
    }),
    createActorFile("door", {
      components: [createComponentFile("door", "Door")]
    })
  ];
}

async function loadSignals(
  actors: SceneActorFile[],
  options: { logger?: Logger; prefabs?: ScenePrefabs; } = {}
) {
  const setup = createSceneSetup({ logger: options.logger });
  const components = new ComponentDefinitions().register(
    definition("Lever", Lever),
    definition("Door", Door)
  );
  const scene = new FileScene("level", createSceneFile(actors), {
    components,
    prefabs: options.prefabs
  });
  await setup.sm.loadScene(scene).done;
  setup.sm.beginFrame();

  function find<T extends ActorComponent>(
    path: string[],
    type: abstract new (...args: any[]) => T
  ): T {
    let actors = setup.sm.tree.children;
    let actor: Actor | undefined;
    for (const name of path) {
      actor = actors.find((child) => child.name === name);
      actors = actor?.children ?? [];
    }

    return actor!.findComponent(type)!;
  }

  return { ...setup, scene, find };
}

describe("Systems.FileScene signals", () => {
  beforeEach(() => {
    Scene.Id.clear();
  });

  test("wires a signal to a method before the actors awake", async() => {
    const { find } = await loadSignals(leverAndDoor([connection()]));

    find(["lever"], Lever).pulled.emit(4);

    assert.deepEqual(find(["door"], Door).forces, [1, 4]);
  });

  test("disconnects a once connection after its first emit", async() => {
    const { find } = await loadSignals(leverAndDoor([connection({ once: true })]));

    find(["lever"], Lever).pulled.emit(4);

    assert.deepEqual(find(["door"], Door).forces, [1]);
  });

  test("stops calling a target once it is destroyed", async() => {
    const { find } = await loadSignals(leverAndDoor([connection()]));
    const door = find(["door"], Door);

    door.destroy();
    find(["lever"], Lever).pulled.emit(4);

    assert.deepEqual(door.forces, [1]);
  });

  for (const [problem, broken] of [
    ["signal not found", connection({ signal: "pushed" })],
    ["target not built", connection({ target: "ghost" })],
    ["method not found", connection({ method: "slam" })]
  ] as const) {
    test(`warns and skips a connection whose ${problem}`, async() => {
      const { logger, warnings } = createWarningLogger();
      const { find } = await loadSignals(
        leverAndDoor([broken, connection({ id: "c2" })]),
        { logger }
      );

      assert.deepEqual(find(["door"], Door).forces, [1]);
      assert.deepEqual(
        warnings().map(([message]) => message),
        [`[WARN] [ecs.file-scene] Signal connection skipped: ${problem}`]
      );
    });
  }

  test("wires the connections of a prefab inside each of its instances", async() => {
    const keep = leverAndDoor([connection()]);
    const { find } = await loadSignals([
      createActorFile("east", { prefab: { id: "keep", kind: "scene" } }),
      createActorFile("west", { prefab: { id: "keep", kind: "scene" } })
    ], {
      prefabs: {
        find: () => {
          return { actors: keep };
        }
      }
    });

    find(["east", "lever"], Lever).pulled.emit(4);

    assert.deepEqual(find(["east", "door"], Door).forces, [1, 4]);
    assert.deepEqual(find(["west", "door"], Door).forces, [1]);
  });

  test("captures the connections of its components", async() => {
    const { scene } = await loadSignals(leverAndDoor([connection({ once: true })]));

    const [lever] = scene.capture().actors;

    assert.deepEqual(lever.components[0].connections, [connection({ once: true })]);
  });
});
