// Import Third-party Dependencies
import {
  FrameScheduler,
  type FrameSchedule
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  Actor,
  Behavior,
  Systems
} from "../src/index.ts";

// CONSTANTS
const kFrameMs = 1000 / 60;

export class IdleBehavior extends Behavior {
  ticks = 0;

  update(): void {
    this.ticks++;
  }
}

export interface BenchWorld {
  world: Systems.World;
  createActor(name: string, parent?: Actor | null): Actor;
  tick(): void;
}

export function createBenchWorld(
  steps = 1
): BenchWorld {
  const sceneManager = new Systems.SceneManager();
  const world: Systems.World = new Systems.World(
    createRenderer(),
    {
      sceneManager,
      input: createInput(),
      audio: {} as any,
      assetCoordinator: {} as any,
      globalsAdapter: {
        exposeGame() {
          return;
        }
      }
    }
  );
  const schedule = createSchedule(steps);

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

export function populate(
  bench: BenchWorld,
  count: number,
  updating: (index: number) => boolean
): void {
  for (let index = 0; index < count; index++) {
    const actor = bench.createActor(`actor-${index}`);
    if (updating(index)) {
      actor.addComponent(IdleBehavior);
    }
  }
}

export function start(
  bench: BenchWorld
): BenchWorld {
  bench.world.connect().start();
  bench.tick();

  return bench;
}

function createSchedule(
  steps: number
): FrameSchedule {
  const scheduler = new FrameScheduler();
  scheduler.advance(0);

  return {
    ...scheduler.advance(kFrameMs),
    steps,
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
    getSource() {
      return null;
    },
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
