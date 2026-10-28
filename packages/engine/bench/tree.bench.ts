// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { createBenchWorld } from "./_fixtures.ts";

const suite = defineSuite("engine / ActorTree", (bench) => {
  const { createActor, world } = createBenchWorld();
  for (let group = 0; group < 100; group++) {
    const parent = createActor(`group-${group}`);
    for (let child = 0; child < 9; child++) {
      createActor(`child-${child}`, parent);
    }
  }
  const { tree } = world.sceneManager;

  bench
    .add("getActor by name, last of 1k", () => {
      tree.getActor("group-99");
    })
    .add("getActor by path", () => {
      tree.getActor("group-99/child-8");
    })
    .add("walk 1k actors", () => {
      let count = 0;
      for (const _node of tree.walk()) {
        count++;
      }

      return count;
    });
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
