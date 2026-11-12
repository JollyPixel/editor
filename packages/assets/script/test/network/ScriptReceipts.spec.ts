// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { SyncedScript } from "#src/network/textDocumentKind.ts";
import type { ScriptStep } from "#src/network/types.ts";
import { ScriptSession } from "../helpers/ScriptSession.ts";

function insert(
  script: SyncedScript,
  at: number,
  text: string
): ScriptStep {
  const step = script.applyStep({
    action: "edited",
    changes: [{ at, insert: text }]
  });
  assert.ok(step !== null);

  return step;
}

function answers(
  script: SyncedScript
): string[] {
  const answered: string[] = [];
  function label(
    event: string,
    step: ScriptStep
  ): string {
    return `${event} ${JSON.stringify(step.command.changes)}`;
  }
  script.receipts.subscribe("confirmed", (step) => answered.push(label("confirmed", step)));
  script.receipts.subscribe("refused", (step) => answered.push(label("refused", step)));

  return answered;
}

describe("script step receipts", () => {
  test("confirms every step merged into one edit once the room accepts it", async() => {
    const session = new ScriptSession("ab");
    const alice = await session.join("A");
    const answered = answers(alice.script);

    insert(alice.script, 0, "1");
    insert(alice.script, 1, "2");
    insert(alice.script, 2, "3");
    assert.equal(alice.room.sent.length, 1);
    await session.settle();

    assert.equal(session.server.state.text, "123ab");
    assert.deepEqual(answered, [
      "confirmed [{\"at\":0,\"insert\":\"1\"}]",
      "confirmed [{\"at\":1,\"insert\":\"2\"}]",
      "confirmed [{\"at\":2,\"insert\":\"3\"}]"
    ]);
  });

  test("refuses a step a snapshot drops before it was sent", async() => {
    const session = new ScriptSession("ab");
    const alice = await session.join("A");
    const answered = answers(alice.script);

    insert(alice.script, 0, "1");
    insert(alice.script, 1, "2");
    await session.resnapshot(alice);
    await session.settle();

    assert.equal(session.server.state.text, "1ab");
    assert.equal(alice.script.document.text, "1ab");
    assert.deepEqual(answered, [
      "refused [{\"at\":1,\"insert\":\"2\"}]",
      "confirmed [{\"at\":0,\"insert\":\"1\"}]"
    ]);
  });

  test("applies no step that does not fit the text", async() => {
    const session = new ScriptSession("ab");
    const alice = await session.join("A");

    const step = alice.script.applyStep({
      action: "edited",
      changes: [{ at: 0, delete: "zz" }]
    });

    assert.equal(step, null);
    assert.equal(alice.script.document.text, "ab");
    assert.deepEqual(alice.room.sent, []);
  });
});
