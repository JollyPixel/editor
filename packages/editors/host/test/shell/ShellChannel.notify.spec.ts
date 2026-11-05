// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  NOTIFICATION_MESSAGE_TYPE,
  parseNotificationMessage
} from "#src/shell/NotificationMessage.ts";
import { ShellChannel } from "#src/shell/ShellChannel.ts";

// CONSTANTS
const kShellOrigin = "http://studio.test";

describe("ShellChannel.notify", () => {
  test("posts a notification, its updates and its dismissal as notification messages", () => {
    const posted: unknown[] = [];
    const channel = new ShellChannel({
      port: { postMessage: (message: unknown) => posted.push(message) },
      origin: kShellOrigin
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
        type: NOTIFICATION_MESSAGE_TYPE,
        action: "notify",
        id: upload.id,
        notification: { tone: "loading", title: "Replacing", progress: 0 }
      },
      {
        type: NOTIFICATION_MESSAGE_TYPE,
        action: "update",
        id: upload.id,
        patch: { tone: "success", title: "Replaced", progress: null }
      },
      {
        type: NOTIFICATION_MESSAGE_TYPE,
        action: "dismiss",
        id: upload.id
      }
    ]);
    assert.deepEqual(posted.map(parseNotificationMessage), posted);
  });

  test("rejects a notification with an unknown tone", () => {
    assert.equal(parseNotificationMessage({
      type: NOTIFICATION_MESSAGE_TYPE,
      action: "notify",
      id: "notification-1",
      notification: { tone: "fatal", title: "Boom" }
    }), undefined);
  });
});
