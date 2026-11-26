// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CapabilityTable,
  defineCapabilities
} from "@jolly-pixel/network/client";
import type { NotificationInit } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorAccess } from "#src/access/EditorAccess.ts";
import { FakeRoom } from "../helpers/rooms.ts";

// CONSTANTS
const kTable = new CapabilityTable(defineCapabilities<"edited">()([
  {
    name: "text",
    label: "Text",
    events: ["edited"]
  }
]));

function editorAccess() {
  const target = new FakeRoom("target");
  const notified: NotificationInit[] = [];
  const access = new EditorAccess({
    target,
    notifications: {
      notify: (init) => {
        notified.push(init);

        return {
          id: String(notified.length),
          update: () => undefined,
          dismiss: () => undefined
        };
      }
    }
  });

  return {
    target,
    access,
    notified
  };
}

function deny(
  room: FakeRoom
): void {
  room.emit("denied", {
    event: "edited",
    reason: "read-only"
  });
}

describe("EditorAccess", () => {
  test("a burst of refused writes across rooms raises one notification until the quiet period ends", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { target, access, notified } = editorAccess();
    const dependency = new FakeRoom("dependency");
    access.target(kTable);
    access.follow(dependency, kTable);

    deny(target);
    deny(dependency);
    deny(target);
    assert.equal(notified.length, 1);
    assert.equal(notified[0].tone, "error");

    t.mock.timers.tick(4_000);
    deny(dependency);
    assert.equal(notified.length, 2);
    access.dispose();
  });

  test("refuses a second set of target grants", () => {
    const { access } = editorAccess();
    access.target(kTable);

    assert.throws(() => access.target(kTable), /already exist/);
    access.dispose();
  });

  test("stops notifying once the editor unmounts", () => {
    const { target, access, notified } = editorAccess();
    access.target(kTable);

    access.dispose();
    deny(target);

    assert.deepEqual(notified, []);
  });
});
