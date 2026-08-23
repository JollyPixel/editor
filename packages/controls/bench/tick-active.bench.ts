// Import Internal Dependencies
import {
  createBench,
  batched,
  kBatch,
  reportBench
} from "./_harness.ts";
import {
  createInput,
  createGamepadSnapshot,
  keyboardEvent,
  mouseEvent,
  touchEvent,
  type BenchInput
} from "./_fixtures.ts";

/**
 * The player is actually playing: keys held, mouse moving with buttons down,
 * both sticks deflected. Measures the per-frame state-transition loops rather
 * than the idle short-circuit.
 */
export async function run(): Promise<void> {
  const bench = createBench("controls / tick — active");

  const active = createActiveInput();
  const keyboardOnly = createActiveInput();
  const gamepadOnly = createActiveInput();
  const movement = mouseEvent(active.canvas, {
    clientX: 900,
    clientY: 500
  }) as MouseEvent & { clientX: number; };

  bench
    .add("Input#update() — 4 keys, 2 mouse buttons, 1 gamepad", batched(() => {
      active.input.update();
    }))
    .add("Keyboard#update() — 4 keys held", batched(() => {
      keyboardOnly.input.keyboard.update();
    }))
    .add("Mouse#update() — 2 buttons held + movement", batched(() => {
      // `update()` consumes `newPosition`; re-arm it so every iteration takes
      // the moved branch rather than the first one taking it and the rest not.
      // The event object is reused so the task measures `update()`, not the
      // fixture's own allocation.
      movement.clientX = movement.clientX === 900 ? 904 : 900;
      active.canvas.dispatch("mousemove", movement);
      active.input.mouse.update();
    }))
    .add("Touchpad#update() — 3 touches down", batched(() => {
      active.input.touchpad.update();
    }))
    .add("Gamepad#update() — 1 gamepad, sticks deflected", batched(() => {
      gamepadOnly.input.gamepad.update();
    }));

  await reportBench(bench, kBatch);
}

export function createActiveInput(): BenchInput {
  const bench = createInput();
  const { canvas, window, input } = bench;

  const gamepad = createGamepadSnapshot();
  for (const index of [0, 1, 4, 12]) {
    (gamepad.buttons[index] as any).pressed = true;
    (gamepad.buttons[index] as any).value = 1;
  }
  (gamepad.axes as unknown as number[])[0] = 0.85;
  (gamepad.axes as unknown as number[])[1] = -0.7;
  (gamepad.axes as unknown as number[])[2] = -0.9;
  (gamepad.axes as unknown as number[])[3] = 0.65;
  window.navigator.gamepads[0] = gamepad;

  for (const code of ["KeyW", "KeyA", "ShiftLeft", "Space"]) {
    bench.document.dispatch("keydown", keyboardEvent(code));
  }

  canvas.dispatch("mousedown", mouseEvent(canvas, { button: 0 }));
  canvas.dispatch("mousedown", mouseEvent(canvas, { button: 2 }));
  canvas.dispatch("mousemove", mouseEvent(canvas, { clientX: 900, clientY: 500 }));
  canvas.dispatch("touchstart", touchEvent(canvas, [0, 1, 2]));

  input.update();

  return bench;
}

if (import.meta.main) {
  await run();
}
