// Import Internal Dependencies
import {
  createBench,
  batched,
  kBatch,
  reportBench
} from "./_harness.ts";
import {
  createInput,
  keyboardEvent,
  mouseEvent,
  touchEvent,
  wheelEvent
} from "./_fixtures.ts";

/**
 * The DOM-facing path. `mousemove` can fire at 1000 Hz on a high-poll mouse, so
 * per-event work — layout reads, object literals, generators — is paid far more
 * often than per-frame work.
 *
 * Layout cost cannot be reproduced outside a browser, so
 * `boundingClientRectCalls` is reported separately as "rect reads per event".
 */
export async function run(): Promise<void> {
  const bench = createBench("controls / events");

  const { canvas, document } = createInput();
  const move = mouseEvent(canvas);
  const moveWithoutOffsets = mouseEvent(canvas, { omitOffsets: true });
  const wheel = wheelEvent(canvas);
  const down = mouseEvent(canvas, { button: 0 });
  const up = mouseEvent(canvas, { button: 0 });
  const keyDown = keyboardEvent("KeyW");
  const keyUp = keyboardEvent("KeyW");
  const touchMoveSingle = touchEvent(canvas, [0]);
  const touchMoveTriple = touchEvent(canvas, [0, 1, 2]);

  bench
    .add("mousemove", batched(() => {
      canvas.dispatch("mousemove", move);
    }))
    .add("mousemove — rect fallback (no offsetX/offsetY)", batched(() => {
      canvas.dispatch("mousemove", moveWithoutOffsets);
    }))
    .add("mousedown + mouseup", batched(() => {
      canvas.dispatch("mousedown", down);
      canvas.dispatch("mouseup", up);
    }))
    .add("wheel", batched(() => {
      canvas.dispatch("wheel", wheel);
    }))
    .add("keydown + keyup", batched(() => {
      document.dispatch("keydown", keyDown);
      document.dispatch("keyup", keyUp);
    }))
    .add("touchmove — 1 touch", batched(() => {
      canvas.dispatch("touchmove", touchMoveSingle);
    }))
    .add("touchmove — 3 touches", batched(() => {
      canvas.dispatch("touchmove", touchMoveTriple);
    }));

  await reportBench(bench, kBatch);
  reportLayoutReads();
}

/**
 * Counts forced-layout reads per event rather than timing them: in Node
 * `getBoundingClientRect` is free, in a browser it can flush style and layout
 * for the whole document.
 */
function reportLayoutReads(): void {
  const rows: { event: string; "rect reads": number; }[] = [];

  for (const [name, run] of layoutScenarios()) {
    const { canvas } = run;
    const before = canvas.boundingClientRectCalls;
    for (let i = 0; i < 100; i++) {
      run.fire();
    }
    rows.push({
      event: name,
      "rect reads": (canvas.boundingClientRectCalls - before) / 100
    });
  }

  console.log("\n# controls / events — forced layout reads");
  console.table(rows);
}

function layoutScenarios() {
  const mouse = createInput();
  const mouseMove = mouseEvent(mouse.canvas);

  const fallback = createInput();
  const fallbackMove = mouseEvent(fallback.canvas, { omitOffsets: true });

  const touch = createInput();
  const touchMove = touchEvent(touch.canvas, [0, 1, 2]);

  return [
    ["mousemove", {
      canvas: mouse.canvas,
      fire: () => mouse.canvas.dispatch("mousemove", mouseMove)
    }],
    ["mousemove — rect fallback", {
      canvas: fallback.canvas,
      fire: () => fallback.canvas.dispatch("mousemove", fallbackMove)
    }],
    ["touchmove — 3 touches", {
      canvas: touch.canvas,
      fire: () => touch.canvas.dispatch("touchmove", touchMove)
    }]
  ] as const;
}

if (import.meta.main) {
  await run();
}
