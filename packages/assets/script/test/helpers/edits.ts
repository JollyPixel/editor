// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import {
  TextEdit,
  type TextChange
} from "#src/model/TextEdit.ts";

export interface EditStep {
  insert: boolean;
  at: number;
  size: number;
  text: string;
}

export const textArbitrary = fc.string({
  unit: fc.constantFrom("a", "b", "\n"),
  maxLength: 12
});

export const editStepsArbitrary = fc.array(
  fc.record({
    insert: fc.boolean(),
    at: fc.nat(),
    size: fc.integer({ min: 1, max: 4 }),
    text: fc.string({
      unit: fc.constantFrom("x", "y", "a"),
      minLength: 1,
      maxLength: 3
    })
  }),
  { minLength: 1, maxLength: 4 }
);

export function editFromSteps(
  text: string,
  steps: readonly EditStep[]
): TextEdit {
  let current = text;
  const changes: TextChange[] = [];
  for (const step of steps) {
    const at = step.at % (current.length + 1);
    if (step.insert || at === current.length) {
      changes.push({ at, insert: step.text });
      current = current.slice(0, at) + step.text + current.slice(at);
    }
    else {
      const removed = current.slice(at, at + step.size);
      changes.push({ at, delete: removed });
      current = current.slice(0, at) + current.slice(at + removed.length);
    }
  }

  return new TextEdit(changes);
}
