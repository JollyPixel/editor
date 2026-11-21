// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { roomBinding } from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import { scriptAssetKind } from "#src/asset/scriptAssetKind.ts";
import type { ScriptText } from "#src/model/ScriptText.ts";
import { TextEdit } from "#src/model/TextEdit.ts";
import type { ScriptNetworkCommand } from "#src/network/types.ts";
import { ScriptSession } from "../helpers/ScriptSession.ts";

function insertion(
  clientId: string,
  at: number,
  insert: string
): ScriptNetworkCommand {
  return {
    action: "edited",
    changes: [{ at, insert }],
    clientId,
    seq: 1,
    timestamp: 0,
    basis: 0
  };
}

function openLive(
  state: ScriptText,
  version: () => number
) {
  const { commands, kind } = scriptAssetKind();
  assert.ok(commands?.live);

  return commands.live(roomBinding({
    kind,
    state,
    version
  }));
}

describe("script live arbitration", () => {
  test("refuses an edit based on the text from before a reload", () => {
    const state = scriptAssetKind().create("a");
    state.replace("ab");
    let version = 0;
    const live = openLive(state, () => version);

    live.arbitrate(insertion("A", 0, "x"))?.commit?.(++version);
    state.replace("replaced");
    live.reloaded?.();

    assert.equal(live.arbitrate(insertion("B", 1, "y")), null);
  });

  test("refuses an edit inserting a carriage return", () => {
    const state = scriptAssetKind().create("a");
    const live = openLive(state, () => 0);

    assert.equal(live.arbitrate(insertion("A", 0, "x\r\n")), null);
    assert.notEqual(live.arbitrate(insertion("A", 0, "x\n")), null);
  });
});

describe("script live format", () => {
  test("a joining peer gets the .editorconfig format and the file saves with its line ending", async() => {
    const session = new ScriptSession("a\nb\n", {
      path: "scripts/player.ts",
      files: {
        ".editorconfig": "root = true\n[*.ts]\nindent_style = tab\nend_of_line = crlf\n"
      }
    });
    const alice = await session.join("A");
    alice.script.document.edit(TextEdit.insertion(0, "x"));
    await session.settle();

    const bob = await session.join("B");
    const saved = await scriptAssetKind().serialize(session.server.state);

    assert.deepEqual(bob.script.document.format.toJSON(), {
      indentStyle: "tab",
      indentSize: 2,
      tabWidth: 2
    });
    assert.equal(new TextDecoder().decode(saved), "xa\r\nb\r\n");
  });
});
