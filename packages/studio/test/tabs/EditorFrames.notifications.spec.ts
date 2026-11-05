// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  NOTIFICATION_MESSAGE_TYPE,
  type ShellCommand
} from "@jolly-pixel/editor.host";
import { NotificationQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  disposeFrames,
  editorFrames,
  frame,
  postFrom
} from "../helpers/editorFrames.ts";
import { MAP_TAB } from "../helpers/editorTabs.ts";

afterEach(disposeFrames);

function readChips(
  queue: NotificationQueue
): string[] {
  return queue.entries.map(
    (entry) => `${entry.source} ${entry.tone} ${entry.title}`
  );
}

describe("EditorFrames notifications", () => {
  test("shows a frame's notifications named by its tab, whatever source it sends", () => {
    const notifications = new NotificationQueue();
    const routed: ShellCommand[] = [];
    const frames = editorFrames({
      notifications,
      onShellCommand: (command) => routed.push(command)
    });
    frames.show(MAP_TAB);
    const source = frame().contentWindow;

    postFrom(source, {
      type: NOTIFICATION_MESSAGE_TYPE,
      action: "notify",
      id: "notification-1",
      notification: { tone: "loading", title: "Replacing", source: "spoof" }
    });
    postFrom(source, {
      type: NOTIFICATION_MESSAGE_TYPE,
      action: "update",
      id: "notification-1",
      patch: { tone: "success", title: "Replaced", source: "spoof" }
    });

    assert.deepEqual(readChips(notifications), [
      `${MAP_TAB.label} success Replaced`
    ]);
    assert.deepEqual(routed, []);
  });

  test("drops a removed frame's loading notifications and keeps its errors", () => {
    const notifications = new NotificationQueue();
    const frames = editorFrames({ notifications });
    frames.show(MAP_TAB);
    const source = frame().contentWindow;
    for (const [id, tone] of [["notification-1", "loading"], ["notification-2", "error"]]) {
      postFrom(source, {
        type: NOTIFICATION_MESSAGE_TYPE,
        action: "notify",
        id,
        notification: { tone, title: tone }
      });
    }

    frames.remove(MAP_TAB.id);

    assert.deepEqual(readChips(notifications), [
      `${MAP_TAB.label} error error`
    ]);
  });
});
