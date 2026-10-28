// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  IdleBehavior,
  createBenchWorld,
  populate,
  start
} from "./_fixtures.ts";

const suite = defineSuite("engine / actor lifecycle", (bench) => {
  const churn = start(createBenchWorld());

  const lookup = createBenchWorld();
  const target = lookup.createActor("target");
  target.addComponent(IdleBehavior);
  start(lookup);

  bench
    .add("create, destroy and flush an actor with a behavior", () => {
      const actor = churn.createActor("churn");
      actor.addComponent(IdleBehavior);
      churn.tick();
      churn.world.sceneManager.tree.destroyActor(actor);
      churn.tick();
    })
    .add("getComponent by class", () => {
      target.getComponent(IdleBehavior);
    })
    .add("getComponent by type name", () => {
      target.getComponent("ScriptBehavior");
    });

  const crowd = createBenchWorld();
  populate(crowd, 1_000, () => true);
  start(crowd);

  bench.add("create and destroy an updating actor among 1k", () => {
    const actor = crowd.createActor("late");
    actor.addComponent(IdleBehavior);
    crowd.tick();
    actor.destroy();
  });
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
