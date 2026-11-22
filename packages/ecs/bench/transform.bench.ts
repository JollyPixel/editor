// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  createBenchWorld,
  type BenchWorld
} from "./_fixtures.ts";
import type { Actor } from "../src/actor/Actor.ts";

// CONSTANTS
const kGroups = 100;
const kChildren = 9;

interface Hierarchy {
  roots: Actor[];
  children: Actor[];
}

function populate(
  bench: BenchWorld
): Hierarchy {
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

const suite = defineSuite("ecs / Transform", (bench) => {
  const offset = { x: 0.01, y: 0, z: 0 };
  const { roots, children } = populate(createBenchWorld());

  bench
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
