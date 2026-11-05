// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import type { ScriptNetworkCommand } from "#src/network/types.ts";
import { TextEdit } from "#src/text/TextEdit.ts";
import {
  editFromSteps,
  editStepsArbitrary,
  textArbitrary
} from "../helpers/edits.ts";
import { ScriptSession } from "../helpers/ScriptSession.ts";

describe("script convergence", () => {
  test("a client starts from the room snapshot", async() => {
    const session = new ScriptSession("let a = 1;\n");
    const { script } = await session.join("A");

    assert.equal(script.document.text, "let a = 1;\n");
  });

  test("two peers typing at the same offset end with the same text", async() => {
    const session = new ScriptSession("ab");
    const alice = await session.join("A");
    const bob = await session.join("B");

    alice.script.document.edit(TextEdit.insertion(1, "1"));
    bob.script.document.edit(TextEdit.insertion(1, "2"));
    await session.settle();

    assert.equal(alice.script.document.text, session.server.state.text);
    assert.equal(bob.script.document.text, session.server.state.text);
    assert.equal(session.server.state.text.length, 4);
  });

  test("keystrokes typed while an edit is unconfirmed reach the room in order", async() => {
    const session = new ScriptSession("x");
    const alice = await session.join("A");
    const bob = await session.join("B");

    alice.script.document.edit(TextEdit.insertion(0, "h"));
    alice.script.document.edit(TextEdit.insertion(1, "i"));
    alice.script.document.edit(TextEdit.insertion(2, "!"));
    bob.script.document.edit(TextEdit.insertion(1, "y"));

    assert.equal(alice.room.sent.length, 1);

    await session.settle();

    assert.equal(session.server.state.text, "hi!xy");
    assert.equal(alice.script.document.text, "hi!xy");
    assert.equal(bob.script.document.text, "hi!xy");
  });

  test("an undo after a peer edit only reverts the local edit", async() => {
    const session = new ScriptSession("line\n");
    const alice = await session.join("A");
    const bob = await session.join("B");

    alice.script.document.edit(TextEdit.insertion(5, "mine"));
    await session.settle();
    bob.script.document.edit(TextEdit.insertion(0, "// peer\n"));
    await session.settle();
    alice.script.document.undo();
    await session.settle();

    assert.equal(session.server.state.text, "// peer\nline\n");
    assert.equal(bob.script.document.text, session.server.state.text);
  });

  test("an edit still pending when a snapshot lands shows the room's rebased copy", async() => {
    const session = new ScriptSession("ab");
    const alice = await session.join("A");
    const bob = await session.join("B");

    bob.script.document.edit(TextEdit.insertion(0, "X"));
    await session.upload(bob);
    alice.script.document.edit(TextEdit.insertion(2, "1"));
    await session.resnapshot(alice);
    await session.settle();

    assert.equal(session.server.state.text, "Xab1");
    assert.equal(alice.script.document.text, "Xab1");
    assert.equal(bob.script.document.text, "Xab1");
  });

  test("an edit typed right after a snapshot builds on the snapshot's version", async() => {
    const session = new ScriptSession("a");
    const alice = await session.join("A");
    const bob = await session.join("B");

    alice.script.document.edit(new TextEdit([
      { at: 0, delete: "a" },
      { at: 0, insert: "x" }
    ]));
    await session.upload(alice);
    await session.resnapshot(bob);
    bob.script.document.edit(TextEdit.deletion(0, "x"));
    await session.settle();

    assert.equal(session.server.state.text, "");
    assert.equal(alice.script.document.text, "");
    assert.equal(bob.script.document.text, "");
  });

  test("a peer edit that does not fit the local text asks the room for one snapshot", async() => {
    const session = new ScriptSession("ab");
    const alice = await session.join("A");
    const misfit: ScriptNetworkCommand = {
      action: "edited",
      changes: [{ at: 1, delete: "zz" }],
      clientId: "B",
      seq: 1,
      timestamp: 0
    };

    for (const version of [8, 9]) {
      alice.room.deliver({
        type: "command",
        version,
        data: misfit
      });
    }

    assert.equal(alice.room.resyncs, 1);
    assert.equal(alice.script.document.text, "ab");
  });

  test("random concurrent edits, undos and snapshots converge on every peer", async() => {
    const actionArbitrary = fc.record({
      peer: fc.nat(2),
      kind: fc.constantFrom("edit", "edit", "undo", "upload", "deliver", "resnapshot"),
      steps: editStepsArbitrary
    });

    await fc.assert(fc.asyncProperty(
      textArbitrary,
      fc.array(actionArbitrary, { maxLength: 24 }),
      async(text, actions) => {
        const session = new ScriptSession(text);
        const peers = [
          await session.join("A"),
          await session.join("B"),
          await session.join("C")
        ];

        for (const { peer: index, kind, steps } of actions) {
          const peer = peers[index];
          const { document } = peer.script;
          if (kind === "edit") {
            document.edit(editFromSteps(document.text, steps));
          }
          else if (kind === "undo") {
            document.undo();
          }
          else if (kind === "upload") {
            await session.upload(peer);
          }
          else if (kind === "resnapshot") {
            await session.resnapshot(peer);
          }
          else {
            session.deliver(peer);
          }
        }
        await session.settle();

        for (const { script } of peers) {
          assert.equal(script.document.text, session.server.state.text);
        }
      }
    ), { numRuns: 150 });
  });
});
