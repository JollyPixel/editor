// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { TextEdit } from "#src/model/TextEdit.ts";
import { TextEditMismatchError } from "#src/model/errors/TextEditMismatchError.ts";
import {
  editFromSteps,
  editStepsArbitrary,
  textArbitrary
} from "../helpers/edits.ts";

describe("TextEdit", () => {
  test("applies its changes in order", () => {
    const edit = new TextEdit([
      { at: 6, delete: "world" },
      { at: 6, insert: "there" },
      { at: 0, insert: "> " }
    ]);

    assert.equal(edit.applyTo("hello world"), "> hello there");
  });

  test("refuses a deletion that does not match the text", () => {
    const edit = TextEdit.deletion(0, "nope");

    assert.equal(edit.fits("hello"), false);
    assert.throws(() => edit.applyTo("hello"), TextEditMismatchError);
  });

  test("between() ends a repeated typed character at the caret", () => {
    const edit = TextEdit.between("aa", "aaa", 2);

    assert.deepEqual(edit.toJSON(), [{ at: 1, insert: "a" }]);
  });

  test("then() folds typing and backspacing into one change", () => {
    const typed = TextEdit.insertion(0, "ab").then(TextEdit.insertion(2, "c"));
    const corrected = typed.then(TextEdit.deletion(2, "c"));

    assert.deepEqual(typed.toJSON(), [{ at: 0, insert: "abc" }]);
    assert.deepEqual(corrected.toJSON(), [{ at: 0, insert: "ab" }]);
    assert.equal(TextEdit.insertion(0, "a").then(TextEdit.deletion(0, "a")).empty, true);
  });

  test("an insertion still pending goes before a committed one at the same offset", () => {
    const later = TextEdit.insertion(2, "L");
    const earlier = TextEdit.insertion(2, "E");
    const { edit, earlier: rebased } = later.rebaseOnto(earlier);

    assert.equal(edit.applyTo(earlier.applyTo("abcd")), "abLEcd");
    assert.equal(rebased.applyTo(later.applyTo("abcd")), "abLEcd");
  });

  test("an insertion inside a concurrent deletion survives it", () => {
    const deletion = TextEdit.deletion(1, "bcd");
    const insertion = TextEdit.insertion(2, "X");
    const { edit } = deletion.rebaseOnto(insertion);

    assert.equal(edit.applyTo(insertion.applyTo("abcde")), "aXe");
  });

  test("mapPosition() keeps a caret on the same character", () => {
    const edit = new TextEdit([
      { at: 0, insert: "12" },
      { at: 4, delete: "cd" }
    ]);

    assert.equal(edit.mapPosition(1), 3);
    assert.equal(edit.mapPosition(3), 4);
    assert.equal(edit.mapPosition(5), 5);
    assert.equal(TextEdit.insertion(1, "x").mapPosition(1, "before"), 1);
  });

  test("two concurrent edits converge whichever lands first", () => {
    fc.assert(fc.property(
      textArbitrary,
      editStepsArbitrary,
      editStepsArbitrary,
      (text, laterSteps, earlierSteps) => {
        const later = editFromSteps(text, laterSteps);
        const earlier = editFromSteps(text, earlierSteps);
        const { edit, earlier: rebased } = later.rebaseOnto(earlier);

        assert.equal(
          edit.applyTo(earlier.applyTo(text)),
          rebased.applyTo(later.applyTo(text))
        );
      }
    ));
  });

  test("invert() undoes an edit and then() matches applying both", () => {
    fc.assert(fc.property(
      textArbitrary,
      editStepsArbitrary,
      editStepsArbitrary,
      (text, firstSteps, secondSteps) => {
        const first = editFromSteps(text, firstSteps);
        const afterFirst = first.applyTo(text);
        const second = editFromSteps(afterFirst, secondSteps);

        assert.equal(first.invert().applyTo(afterFirst), text);
        assert.equal(first.then(second).applyTo(text), second.applyTo(afterFirst));
      }
    ));
  });
});
