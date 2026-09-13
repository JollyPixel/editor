// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Input } from "../../../src/index.ts";
import { SequenceInputs } from "../../../src/combination/conditions/index.ts";
import { InputCombination } from "../../../src/combination/index.ts";
import type { KeyCode } from "../../../src/devices/index.ts";
import * as mocks from "../../mocks/index.ts";
import {
  KeyboardDocumentAdapter
} from "../../devices/keyboard/Keyboard.fixture.ts";

describe("Controls.SequenceInputs.Hold", () => {
  let documentAdapter: KeyboardDocumentAdapter;
  let input: Input;
  let time: number;

  function frame(
    changes: { down?: KeyCode[]; up?: KeyCode[]; } = {},
    elapsedMs = 16
  ) {
    for (const code of changes.down ?? []) {
      documentAdapter.dispatchEvent("keydown", { code });
    }
    for (const code of changes.up ?? []) {
      documentAdapter.dispatchEvent("keyup", { code });
    }
    time += elapsedMs;
    input.keyboard.update();
  }

  function ctrlAltX() {
    return new SequenceInputs(
      [
        InputCombination.hold("ControlLeft"),
        InputCombination.hold("AltLeft"),
        InputCombination.key("KeyX")
      ],
      100,
      () => time
    );
  }

  beforeEach(() => {
    time = 0;
    documentAdapter = new KeyboardDocumentAdapter();
    input = new Input(new mocks.CanvasAdapter(), {
      documentAdapter
    });
    input.keyboard.connect();
  });

  test("matches held steps pressed in order", () => {
    const sequence = ctrlAltX();

    frame({ down: ["ControlLeft"] });
    assert.strictEqual(sequence.evaluate(input), false);
    frame({ down: ["AltLeft"] });
    assert.strictEqual(sequence.evaluate(input), false);
    frame({ down: ["KeyX"] });
    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("does not expire while the last matched step is held", () => {
    const sequence = ctrlAltX();

    frame({ down: ["ControlLeft"] });
    sequence.evaluate(input);
    frame({}, 1_000);
    sequence.evaluate(input);
    frame({ down: ["AltLeft"] }, 1_000);
    sequence.evaluate(input);
    frame({ down: ["KeyX"] }, 1_000);

    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("matches held steps pressed during the same frame", () => {
    const sequence = ctrlAltX();

    frame({ down: ["ControlLeft", "AltLeft"] });
    assert.strictEqual(sequence.evaluate(input), false);
    frame({ down: ["KeyX"] });
    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("rejects held steps pressed out of order", () => {
    const sequence = ctrlAltX();

    frame({ down: ["AltLeft"] });
    sequence.evaluate(input);
    frame({ down: ["ControlLeft"] });
    sequence.evaluate(input);
    frame({ down: ["KeyX"] });

    assert.strictEqual(sequence.evaluate(input), false);
  });

  test("rolls back to the first released held step", () => {
    const sequence = ctrlAltX();

    frame({ down: ["ControlLeft"] });
    sequence.evaluate(input);
    frame({ down: ["AltLeft"] });
    sequence.evaluate(input);
    frame({ up: ["AltLeft"] });
    sequence.evaluate(input);
    frame({ down: ["KeyX"] });
    assert.strictEqual(sequence.evaluate(input), false);

    frame({ up: ["KeyX"], down: ["AltLeft"] });
    assert.strictEqual(sequence.evaluate(input), false);
    frame({ down: ["KeyX"] });
    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("restarts from the first step when the first held step is released", () => {
    const sequence = ctrlAltX();

    frame({ down: ["ControlLeft"] });
    sequence.evaluate(input);
    frame({ down: ["AltLeft"] });
    sequence.evaluate(input);
    frame({ up: ["ControlLeft"] });
    sequence.evaluate(input);
    frame({ down: ["KeyX"] });

    assert.strictEqual(sequence.evaluate(input), false);
  });

  test("fires again on each final press while held steps stay held", () => {
    const sequence = ctrlAltX();

    frame({ down: ["ControlLeft", "AltLeft"] });
    sequence.evaluate(input);
    frame({ down: ["KeyX"] });
    assert.strictEqual(sequence.evaluate(input), true);

    frame({ up: ["KeyX"] }, 1_000);
    assert.strictEqual(sequence.evaluate(input), false);
    frame({ down: ["KeyX"] }, 1_000);
    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("times out after a non-held step back to the step after the last held one", () => {
    const sequence = new SequenceInputs(
      [
        InputCombination.hold("ControlLeft"),
        InputCombination.key("KeyK"),
        InputCombination.key("KeyC")
      ],
      100,
      () => time
    );

    frame({ down: ["ControlLeft"] });
    sequence.evaluate(input);
    frame({ down: ["KeyK"] });
    sequence.evaluate(input);
    frame({ up: ["KeyK"], down: ["KeyC"] }, 200);
    assert.strictEqual(sequence.evaluate(input), false);

    frame({ up: ["KeyC"], down: ["KeyK"] });
    sequence.evaluate(input);
    frame({ up: ["KeyK"], down: ["KeyC"] });
    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("advances a single non-held step per evaluation", () => {
    const sequence = new SequenceInputs(
      [
        InputCombination.key("ArrowUp"),
        InputCombination.key("ArrowUp")
      ],
      100,
      () => time
    );

    frame({ down: ["ArrowUp"] });

    assert.strictEqual(sequence.evaluate(input), false);
  });
});
