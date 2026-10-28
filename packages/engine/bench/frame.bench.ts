// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  createBenchWorld,
  populate,
  start
} from "./_fixtures.ts";

const suite = defineSuite("engine / World#tick", (bench) => {
  const empty = start(createBenchWorld());

  const idle = createBenchWorld();
  populate(idle, 1_000, () => false);
  start(idle);

  const sparse = createBenchWorld();
  populate(sparse, 1_000, (index) => index % 10 === 0);
  start(sparse);

  const busy = createBenchWorld();
  populate(busy, 1_000, () => true);
  start(busy);

  const catchUp = createBenchWorld(4);
  populate(catchUp, 1_000, () => true);
  start(catchUp);

  bench
    .add("empty world", empty.tick)
    .add("1k static actors", idle.tick)
    .add("1k actors, 10% updating", sparse.tick)
    .add("1k updating actors", busy.tick)
    .add("1k updating actors, 4 fixed steps", catchUp.tick);
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
