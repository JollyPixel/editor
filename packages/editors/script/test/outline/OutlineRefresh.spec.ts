// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ScriptDocument,
  ScriptOutlineFeed,
  TextEdit
} from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import {
  OUTLINE_REFRESH_DELAY,
  OutlineRefresh
} from "#src/outline/OutlineRefresh.ts";
import { FakeNetwork } from "../helpers/FakeNetwork.ts";

describe("OutlineRefresh", () => {
  test("requests one outline once local typing pauses, and none for peer edits", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const room = new FakeNetwork().connect("A");
    const document = new ScriptDocument();
    const refresh = new OutlineRefresh(document, new ScriptOutlineFeed(room));
    t.after(() => refresh.dispose());

    document.edit(TextEdit.insertion(0, "a"));
    t.mock.timers.tick(OUTLINE_REFRESH_DELAY / 2);
    document.edit(TextEdit.insertion(1, "b"));
    t.mock.timers.tick(OUTLINE_REFRESH_DELAY);
    document.applyRemote(TextEdit.insertion(0, "x"), "B");
    t.mock.timers.tick(OUTLINE_REFRESH_DELAY * 2);

    assert.deepEqual(room.sent, [{ action: "outline-requested" }]);
  });
});
