// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { createActiveInput } from "./tick-active.bench.ts";
import { InputCombination } from "../src/index.ts";

/**
 * Every atomic condition funnels into the query path, so a 4-condition combo
 * multiplies whatever `isDown`/`wasJustPressed` cost by four.
 */
const suite = defineSuite("controls / combinations", (bench) => {
  const { input } = createActiveInput();

  const all = InputCombination.all(
    "KeyW.down",
    "ShiftLeft.down",
    "Space.down",
    "KeyA.down"
  );
  const atLeastOne = InputCombination.atLeastOne(
    "KeyQ.down",
    "KeyE.down",
    "KeyR.down",
    "KeyW.down"
  );
  const none = InputCombination.none(
    "KeyQ.down",
    "KeyE.down",
    "KeyR.down"
  );
  const sequence = InputCombination.sequence(
    "KeyW.pressed",
    "KeyA.pressed",
    "Space.pressed"
  );
  const mixed = InputCombination.all(
    InputCombination.key("KeyW", "down"),
    InputCombination.mouse("left", "down"),
    InputCombination.gamepad(0, "A", "down")
  );
  const single = InputCombination.key("KeyW", "down");

  bench
    .add("AtomicInput#evaluate — key.down", batched(() => {
      single.evaluate(input);
    }))
    .add("AllInputs#evaluate — 4 keys", batched(() => {
      all.evaluate(input);
    }))
    .add("AtLeastOneInput#evaluate — 4 keys", batched(() => {
      atLeastOne.evaluate(input);
    }))
    .add("NoneInputs#evaluate — 3 keys", batched(() => {
      none.evaluate(input);
    }))
    .add("SequenceInputs#evaluate — 3 keys", batched(() => {
      sequence.evaluate(input);
    }))
    .add("AllInputs#evaluate — key + mouse + gamepad", batched(() => {
      mixed.evaluate(input);
    }));
}, { opsPerIteration: "batch" });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
