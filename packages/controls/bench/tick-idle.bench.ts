// Import Internal Dependencies
import {
  createBench,
  batched,
  kBatch,
  reportBench
} from "./_harness.ts";
import {
  createInput,
  createGamepadSnapshot
} from "./_fixtures.ts";

/**
 * The 99% case: `World#update()` ticks `Input` every frame while the player is
 * holding nothing. Every millisecond here is paid whether or not the game reads
 * a single input, so this suite is the primary target of the idle-gating work.
 */
export async function run(): Promise<void> {
  const bench = createBench("controls / tick — idle");

  const idle = createInput();

  const withGamepad = createInput();
  withGamepad.window.navigator.gamepads[0] = createGamepadSnapshot();

  bench
    .add("Input#update() — nothing held, no gamepad", batched(() => {
      idle.input.update();
    }))
    .add("Input#update() — nothing held, 1 gamepad connected", batched(() => {
      withGamepad.input.update();
    }))
    .add("Mouse#update() — idle", batched(() => {
      idle.input.mouse.update();
    }))
    .add("Keyboard#update() — idle, empty map", batched(() => {
      idle.input.keyboard.update();
    }))
    .add("Touchpad#update() — idle", batched(() => {
      idle.input.touchpad.update();
    }))
    .add("Gamepad#update() — idle, no gamepad", batched(() => {
      idle.input.gamepad.update();
    }));

  await reportBench(bench, kBatch);
}

if (import.meta.main) {
  await run();
}
