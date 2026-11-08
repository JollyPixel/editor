// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import * as THREE from "three";

// Import Internal Dependencies
import { Systems } from "../src/index.ts";
import {
  createBenchWorld,
  type BenchWorld
} from "./_fixtures.ts";
import type { Actor } from "../src/core/actor/Actor.ts";

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

const suite = defineSuite("engine / Transform", (bench) => {
  const position = new THREE.Vector3();
  const offset = { x: 0.01, y: 0, z: 0 };

  for (const [label, graph] of [
    ["three graph", new Systems.ThreeSceneGraph()],
    ["headless graph", new Systems.HeadlessSceneGraph()]
  ] as const) {
    const { roots, children } = populate(createBenchWorld(1, graph));

    bench
      .add(`move 1k actors, ${label}`, () => {
        for (const child of children) {
          child.transform.local.move(offset);
        }
      })
      .add(`move 100 roots then read 900 children, ${label}`, () => {
        for (const root of roots) {
          root.transform.local.move(offset);
        }
        let sum = 0;
        for (const child of children) {
          sum += position.copy(child.transform.global.position).x;
        }

        return sum;
      });
  }
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
