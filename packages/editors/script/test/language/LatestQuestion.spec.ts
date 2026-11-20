// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { LatestQuestion } from "#src/language/LatestQuestion.ts";

describe("LatestQuestion", () => {
  test("delivers only the answer to the newest question about the current text", async() => {
    let text = "a";
    const question = new LatestQuestion(() => text);
    const answers: string[] = [];
    function record(
      value: string,
      about: string
    ): void {
      answers.push(`${value}@${about}`);
    }

    question.ask((about) => Promise.resolve(`first ${about}`), record);
    question.ask((about) => Promise.resolve(`second ${about}`), record);
    await setImmediate();

    question.ask((about) => Promise.resolve(`stale ${about}`), record);
    text = "ab";
    await setImmediate();

    question.ask((about) => Promise.resolve(`cancelled ${about}`), record);
    question.cancel();
    await setImmediate();

    assert.deepEqual(answers, ["second a@a"]);
  });
});
