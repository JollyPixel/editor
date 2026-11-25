// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  ScriptDocument,
  TextEdit
} from "@jolly-pixel/asset.script/client";
import { FakeNetwork } from "@jolly-pixel/network/testing";

// Import Internal Dependencies
import { CodeAssist } from "#src/language/CodeAssist.ts";

function setup() {
  const document = new ScriptDocument();
  document.load("let a = 1;");
  const room = new FakeNetwork().connect("A");
  const asked: string[] = [];
  const assist = new CodeAssist({
    document,
    room,
    questions: {
      diagnostics: (text) => {
        asked.push(text);

        return Promise.resolve([{
          start: 4,
          length: 1,
          severity: "error",
          message: `type error in ${text}`,
          code: null
        }]);
      },
      completions: () => Promise.resolve([]),
      quickInfo: () => Promise.resolve(null)
    }
  });

  return {
    document,
    room,
    asked,
    assist
  };
}

describe("CodeAssist", () => {
  test("asks the type checker and the lint relay again 400 ms after the last edit", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { document, room, asked, assist } = setup();

    document.edit(TextEdit.insertion(0, "x"));
    t.mock.timers.tick(300);
    document.edit(TextEdit.insertion(0, "y"));
    t.mock.timers.tick(399);
    assert.deepEqual(asked, ["let a = 1;"]);
    assert.equal(room.sent.length, 1);

    t.mock.timers.tick(1);
    await setImmediate();

    assert.deepEqual(asked, ["let a = 1;", "yxlet a = 1;"]);
    assert.equal(room.sent.length, 2);
    assert.deepEqual(
      assist.diagnostics.all.map(({ message }) => message),
      ["type error in yxlet a = 1;"]
    );
  });

  test("asks nothing for an edit made before it was disposed", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { document, room, asked, assist } = setup();

    document.edit(TextEdit.insertion(0, "x"));
    assist.dispose();
    t.mock.timers.tick(400);

    assert.deepEqual(asked, ["let a = 1;"]);
    assert.equal(room.sent.length, 1);
  });
});
