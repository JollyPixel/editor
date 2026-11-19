// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { nothing } from "lit";

// Import Internal Dependencies
import { CodeDiagnostics } from "#src/diagnostics/CodeDiagnostics.ts";
import type { CodeAssistant } from "#src/language/CodeAssistant.ts";
import { HoverHint } from "#src/panes/code/HoverHint.ts";
import { TextLines } from "#src/text/TextLines.ts";

const kLines = new TextLines("let value = 1;");
const kBounds = { left: 0, top: 0 } as DOMRect;

function pointerAt(
  column: number
): PointerEvent {
  return { clientX: column, clientY: 0 } as PointerEvent;
}

describe("HoverHint", () => {
  test("stays open while the pointer travels from the squiggle into it, closes after it leaves", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const diagnostics = new CodeDiagnostics(() => undefined);
    diagnostics.replace("lint", [{
      start: 4,
      length: 5,
      severity: "warning",
      message: "'value' is never read.",
      code: "no-unused-vars"
    }]);
    const hint = new HoverHint({ requestUpdate: () => undefined } as never, {
      assistant: { quickInfo: () => Promise.resolve(null) } as unknown as CodeAssistant,
      diagnostics,
      lines: () => kLines,
      pointAt: (x) => {
        return { line: 0, visualColumn: x };
      }
    });
    const layout = { lines: kLines, top: () => "0px" };
    function visible(): boolean {
      return hint.render(layout) !== nothing;
    }

    hint.track(pointerAt(6), kBounds);
    t.mock.timers.tick(400);
    assert.ok(visible());

    hint.track(pointerAt(12), kBounds);
    assert.ok(visible());

    hint.hold();
    t.mock.timers.tick(5_000);
    assert.ok(visible());

    hint.leave();
    t.mock.timers.tick(400);
    assert.equal(visible(), false);
  });
});
