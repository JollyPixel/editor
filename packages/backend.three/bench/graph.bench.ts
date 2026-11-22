// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import {
  FrameScheduler,
  type FrameSchedule
} from "@jolly-pixel/loop";
import {
  Actor,
  Behavior,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { ThreeSceneGraph } from "../src/scene/ThreeSceneGraph.ts";

// CONSTANTS
const kFrameMs = 1000 / 60;
const kGroups = 100;
const kChildren = 9;

class IdleBehavior extends Behavior {
  ticks = 0;

  update(): void {
    this.ticks++;
  }
}

interface BenchWorld {
  world: Systems.World;
  createActor(name: string, parent?: Actor | null): Actor;
  tick(): void;
}

function createBenchWorld(): BenchWorld {
  const world: Systems.World = new Systems.World(
    createRenderer(),
    {
      graph: new ThreeSceneGraph(),
      input: createInput(),
      audio: {} as any,
      assetCoordinator: {} as any
    }
  );
  const schedule = createSchedule();

  return {
    world,
    createActor(name, parent = null) {
      return world.createActor(name, { parent });
    },
    tick() {
      world.tick(schedule);
    }
  };
}

function start(
  bench: BenchWorld
): BenchWorld {
  bench.world.connect().start();
  bench.tick();

  return bench;
}

function createHierarchy(
  bench: BenchWorld
): { roots: Actor[]; children: Actor[]; } {
  const roots: Actor[] = [];
  const children: Actor[] = [];
  for (let group = 0; group < kGroups; group++) {
    const root = bench.createActor(`group-${group}`);
    roots.push(root);
    for (let child = 0; child < kChildren; child++) {
      const actor = bench.createActor(`child-${child}`, root);
      actor.transform.local.position = { x: child, y: 0, z: 0 };
      children.push(actor);
    }
  }

  return { roots, children };
}

function createSchedule(): FrameSchedule {
  const scheduler = new FrameScheduler();
  scheduler.advance(0);

  return {
    ...scheduler.advance(kFrameMs),
    steps: 1,
    render: true
  };
}

function createRenderer() {
  return {
    canvas: {
      addEventListener() {
        return;
      },
      removeEventListener() {
        return;
      }
    },
    draw() {
      return;
    },
    clear() {
      return;
    },
    observeResize() {
      return;
    },
    unobserveResize() {
      return;
    },
    source: null,
    dispose() {
      return;
    }
  } as any;
}

function createInput() {
  return {
    connect() {
      return;
    },
    disconnect() {
      return;
    },
    sample() {
      return;
    },
    publish() {
      return;
    },
    exited: false
  } as any;
}

const suite = defineSuite("backend.three / ThreeSceneGraph", (bench) => {
  const churn = start(createBenchWorld());

  const lookup = createBenchWorld();
  const target = lookup.createActor("target");
  target.addComponent(IdleBehavior);
  start(lookup);

  const crowd = createBenchWorld();
  for (let index = 0; index < 1_000; index++) {
    crowd.createActor(`actor-${index}`).addComponent(IdleBehavior);
  }
  start(crowd);

  const offset = { x: 0.01, y: 0, z: 0 };
  const { roots, children } = createHierarchy(createBenchWorld());

  bench
    .add("create, destroy and flush an actor with a behavior", () => {
      const actor = churn.createActor("churn");
      actor.addComponent(IdleBehavior);
      churn.tick();
      actor.markDestructionPending();
      churn.tick();
    })
    .add("findComponent by class", () => {
      target.findComponent(IdleBehavior);
    })
    .add("findComponent by type name", () => {
      target.findComponent("ScriptBehavior");
    })
    .add("create and destroy an updating actor among 1k", () => {
      const actor = crowd.createActor("late");
      actor.addComponent(IdleBehavior);
      crowd.tick();
      actor.destroy();
    })
    .add("move 1k actors", () => {
      for (const child of children) {
        child.transform.local.move(offset);
      }
    })
    .add("move 100 roots then read 900 children", () => {
      for (const root of roots) {
        root.transform.local.move(offset);
      }
      let sum = 0;
      for (const child of children) {
        sum += child.transform.global.position.x;
      }

      return sum;
    });
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
