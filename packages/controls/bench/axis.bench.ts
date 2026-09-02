// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { createActiveInput } from "./tick-active.bench.ts";
import {
  Axis,
  AxisMap,
  GamepadAxisSource,
  InputCombination
} from "../src/index.ts";

// CONSTANTS
const kStressAxisCount = 32;

/**
 * `AxisMap#update` runs once per frame and resolves every bound axis, so its
 * cost is the product of axes, sources per axis, and conditions per source.
 * The named tasks isolate each of those multipliers.
 */
const suite = defineSuite("controls / axis", (bench) => {
  const { input } = createActiveInput();

  const singleButton = Axis.buttons("KeyD.down", "KeyA.down");
  const combined = Axis.buttons("KeyD.down", "KeyA.down")
    .or(new GamepadAxisSource(0, "LeftStickX"));
  const composite = Axis.buttons(
    InputCombination.atLeastOne("KeyW.down", "ArrowUp.down"),
    InputCombination.atLeastOne("KeyS.down", "ArrowDown.down")
  );
  const stick = Axis.gamepadStick(0, "LeftStickY", { invert: true });

  const axes = createMovementMap();
  const disabled = createMovementMap();
  disabled.enabled = false;

  const stress = new AxisMap(
    Object.fromEntries(
      Array.from({ length: kStressAxisCount }, (_, index) => [
        `axis${index}`,
        Axis.buttons("KeyW.down", "KeyS.down")
      ])
    )
  );

  const target = {
    x: 0,
    y: 0,
    z: 0
  };

  bench
    .add("Axis#sample — 1 button source", batched(() => {
      singleButton.sample(input);
    }))
    .add("Axis#sample — button + gamepad stick", batched(() => {
      combined.sample(input);
    }))
    .add("Axis#sample — 2 atLeastOne composites", batched(() => {
      composite.sample(input);
    }))
    .add("Axis#sample — gamepad stick only", batched(() => {
      stick.sample(input);
    }))
    .add("AxisMap#update — 3 axes, 5 sources", batched(() => {
      axes.update(input);
    }))
    .add("AxisMap#update — 3 axes, disabled", batched(() => {
      disabled.update(input);
    }))
    .add(`AxisMap#update — ${kStressAxisCount} button axes`, batched(() => {
      stress.update(input);
    }))
    .add("AxisMap#value", batched(() => {
      axes.value("moveForward");
    }))
    .add("AxisMap#vector3", batched(() => {
      axes.vector3("moveRight", "moveUp", "moveForward", target);
    }))
    .add("AxisMap#reset", batched(() => {
      axes.reset();
    }));
}, { opsPerIteration: "batch" });

export default suite;

/**
 * The binding set from `docs/axismap.md`: one plain two-key axis, one keyboard
 * axis fed by a composite half, and two axes a gamepad stick also drives.
 */
function createMovementMap() {
  return new AxisMap({
    moveRight: Axis.buttons("KeyD.down", "KeyA.down")
      .or(new GamepadAxisSource(0, "LeftStickX")),
    moveUp: Axis.buttons(
      "Space.down",
      InputCombination.atLeastOne("ShiftLeft.down", "ShiftRight.down")
    ),
    moveForward: Axis.buttons(
      InputCombination.atLeastOne("KeyW.down", "ArrowUp.down"),
      InputCombination.atLeastOne("KeyS.down", "ArrowDown.down")
    ).or(new GamepadAxisSource(0, "LeftStickY", { invert: true }))
  });
}

if (import.meta.main) {
  await runSuites([suite]);
}
