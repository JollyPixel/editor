// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  APPEARANCE_MESSAGE_TYPE,
  SESSION_RENEWED_MESSAGE_TYPE
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  disposeFrames,
  editorFrames,
  frame,
  FRAME_ORIGIN,
  recordPosts,
  scope
} from "../helpers/editorFrames.ts";
import {
  MAP_TAB,
  OTHER_TAB
} from "../helpers/editorTabs.ts";

afterEach(disposeFrames);

describe("EditorFrames broadcast", () => {
  test("posts the page appearance to loaded frames when it changes", async() => {
    const element = scope();
    editorFrames().show(MAP_TAB);
    const posted = recordPosts(frame());

    element.setAttribute("theme", "light");
    await setImmediate();

    assert.deepEqual(posted, [
      [
        {
          type: APPEARANCE_MESSAGE_TYPE,
          appearance: { theme: "light", density: "comfortable" }
        },
        FRAME_ORIGIN
      ]
    ]);
  });

  test("tells every frame, shown or hidden, that the session was renewed", () => {
    const frames = editorFrames();
    frames.show(MAP_TAB);
    frames.show(OTHER_TAB);
    const posted = [...document.querySelectorAll("iframe")].map(recordPosts);

    frames.notifySessionRenewed();

    const renewed = [{ type: SESSION_RENEWED_MESSAGE_TYPE }, FRAME_ORIGIN];
    assert.deepEqual(posted, [[renewed], [renewed]]);
  });
});
