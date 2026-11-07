// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseFrameMessage } from "#src/shell/protocol.ts";
import { shellChannel } from "../helpers/shell.ts";

describe("ShellChannel.notify", () => {
  test("posts a notification, its updates and its dismissal as notification messages", () => {
    const posted: unknown[] = [];
    const channel = shellChannel({
      port: { postMessage: (message: unknown) => posted.push(message) }
    });

    const upload = channel.notify({
      tone: "loading",
      title: "Replacing",
      progress: 0
    });
    upload.update({ tone: "success", title: "Replaced", progress: null });
    upload.dismiss();

    assert.deepEqual(posted, [
      {
        type: "jolly-notification",
        id: upload.id,
        notification: { tone: "loading", title: "Replacing", progress: 0 }
      },
      {
        type: "jolly-notification-update",
        id: upload.id,
        patch: { tone: "success", title: "Replaced", progress: null }
      },
      {
        type: "jolly-notification-dismiss",
        id: upload.id
      }
    ]);
    assert.deepEqual(posted.map(parseFrameMessage), posted);
  });
});
