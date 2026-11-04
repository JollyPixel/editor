// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ScriptDocument,
  TextEdit
} from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import { ScriptCaret } from "#src/text/ScriptCaret.ts";
import { ScriptCollaboration } from "#src/collaboration/ScriptCollaboration.ts";
import { FakeNetwork } from "../helpers/FakeNetwork.ts";

function setup() {
  const network = new FakeNetwork();
  const document = new ScriptDocument();
  document.load("let a = 1;\n");
  const local = new ScriptCollaboration({
    room: network.connect("A"),
    document
  });
  const bob = new ScriptCollaboration({
    room: network.connect("B"),
    document: new ScriptDocument()
  });

  return {
    document,
    local,
    bob
  };
}

describe("ScriptCollaboration", () => {
  test("shows a peer caret published over presence", () => {
    const { local, bob } = setup();

    bob.publish(new ScriptCaret(4, 5));

    assert.deepEqual(
      local.carets.map(({ peer, caret }) => [peer.clientId, caret.toJSON()]),
      [["B", { anchor: 4, head: 5 }]]
    );
  });

  test("a peer caret follows edits from others but not the edit of its own author", () => {
    const { document, local, bob } = setup();
    bob.publish(new ScriptCaret(4, 4));

    document.applyRemote(TextEdit.insertion(0, "// C\n"), "C");
    assert.equal(local.carets[0]?.caret.head, 9);

    document.applyRemote(TextEdit.insertion(5, "x"), "B");
    assert.equal(local.carets[0]?.caret.head, 9);
  });

  test("a peer caret published ahead of its edit lands once the edit arrives", () => {
    const { document, local, bob } = setup();

    bob.publish(new ScriptCaret(15, 15));
    assert.equal(local.carets[0]?.caret.head, 11);

    document.applyRemote(TextEdit.insertion(11, "abcd"), "B");
    assert.equal(local.carets[0]?.caret.head, 15);
  });
});
