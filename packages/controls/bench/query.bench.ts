// Import Internal Dependencies
import {
  createBench,
  batched,
  kBatch,
  reportBench
} from "./_harness.ts";
import { createActiveInput } from "./tick-active.bench.ts";

/**
 * What behaviors actually call. `Camera3DControls` alone issues six
 * `keyboard.isDown()` plus two mouse queries every frame, so these run an order
 * of magnitude more often than `update()` does.
 */
/**
 * Assigning results to a module-level binding keeps V8 from eliminating the
 * calls as dead code.
 */
let sink: unknown;

export async function run(): Promise<void> {
  const bench = createBench("controls / query");

  const { input } = createActiveInput();
  const { keyboard, mouse, gamepad, touchpad, screen } = input;

  bench
    .add("keyboard.isDown(\"KeyW\") — direct code", batched(() => {
      sink = keyboard.isDown("KeyW");
    }))
    .add("keyboard.isDown(\"W\") — alphabet transformer", batched(() => {
      sink = keyboard.isDown("W");
    }))
    .add("keyboard.isDown(\"ANY\")", batched(() => {
      sink = keyboard.isDown("ANY");
    }))
    .add("keyboard.wasJustPressed(\"ANY\")", batched(() => {
      sink = keyboard.wasJustPressed("ANY");
    }))
    .add("keyboard.wasJustReleased(\"KeyW\")", batched(() => {
      sink = keyboard.wasJustReleased("KeyW");
    }))
    .add("mouse.isDown(\"left\")", batched(() => {
      sink = mouse.isDown("left");
    }))
    .add("mouse.isDown(0) — numeric", batched(() => {
      sink = mouse.isDown(0);
    }))
    .add("mouse.isDown(\"ANY\")", batched(() => {
      sink = mouse.isDown("ANY");
    }))
    .add("mouse.wasJustPressed(\"left\")", batched(() => {
      sink = mouse.wasJustPressed("left");
    }))
    .add("gamepad.isButtonDown(0, \"A\")", batched(() => {
      sink = gamepad.isButtonDown(0, "A");
    }))
    .add("gamepad.axisValue(0, \"LeftStickX\")", batched(() => {
      sink = gamepad.axisValue(0, "LeftStickX");
    }))
    .add("mouse.position", batched(() => {
      sink = mouse.position;
    }))
    .add("mouse.worldPosition", batched(() => {
      sink = mouse.worldPosition;
    }))
    .add("mouse.viewportDelta(true)", batched(() => {
      sink = mouse.viewportDelta(true);
    }))
    .add("touchpad.isDown(\"primary\")", batched(() => {
      sink = touchpad.isDown("primary");
    }))
    .add("screen.bounds", batched(() => {
      sink = screen.bounds;
    }))
    .add("Camera3DControls frame — 6 keys + 2 mouse + worldPosition", batched(() => {
      sink = keyboard.isDown("KeyW");
      sink = keyboard.isDown("KeyS");
      sink = keyboard.isDown("Space");
      sink = keyboard.isDown("ShiftLeft");
      sink = keyboard.isDown("KeyD");
      sink = keyboard.isDown("KeyA");
      sink = mouse.isDown("right");
      sink = mouse.wasJustReleased("right");
      sink = mouse.viewportDelta(true);
    }));

  await reportBench(bench, kBatch);

  if (sink === Symbol.for("unreachable")) {
    throw new Error("unreachable");
  }
}

if (import.meta.main) {
  await run();
}
