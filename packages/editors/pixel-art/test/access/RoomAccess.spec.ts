// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  Right,
  RoomEventMap
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  RoomAccess,
  type AccessPanel
} from "../../src/access/RoomAccess.ts";
import type { PixelArtAccess } from "../../src/access/PixelArtAccess.ts";
import type { TextureUpdate } from "../../src/textures/TextureEntry.ts";

type EventName = keyof RoomEventMap;

class FakeRoom {
  clientId: string | null = null;
  fallback: Right = "void";
  readonly #listeners = new Map<EventName, Set<RoomEventMap[EventName]>>();

  can(): Right {
    return this.fallback;
  }

  on<K extends EventName>(
    type: K,
    listener: RoomEventMap[K]
  ): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  off<K extends EventName>(
    type: K,
    listener: RoomEventMap[K]
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }

  admit(
    right: Right
  ): void {
    this.clientId = "self";
    this.fallback = right;
    for (const listener of this.#listeners.get("sync") ?? []) {
      (listener as RoomEventMap["sync"])({
        self: "self",
        clientIds: []
      });
    }
  }

  deny(
    event: string
  ): void {
    for (const listener of this.#listeners.get("denied") ?? []) {
      (listener as RoomEventMap["denied"])({
        event,
        reason: "denied"
      });
    }
  }
}

class FakePanel implements AccessPanel {
  readonly access = new Map<string, PixelArtAccess>();
  readonly messages: string[] = [];

  updateTexture(
    id: string,
    changes: TextureUpdate
  ): void {
    if (changes.access !== undefined) {
      this.access.set(id, changes.access);
    }
  }

  announce(
    message: string
  ): void {
    this.messages.push(message);
  }
}

describe("RoomAccess", () => {
  test("follows the rights of every sync, so a promotion unlocks the texture", () => {
    const room = new FakeRoom();
    const panel = new FakePanel();
    new RoomAccess(room, panel, "texture");
    assert.equal(panel.access.get("texture")?.readOnly, false);

    room.admit("read");
    assert.equal(panel.access.get("texture")?.readOnly, true);

    room.admit("write");
    assert.equal(panel.access.get("texture")?.has("pixels"), true);
    assert.equal(panel.access.get("texture")?.readOnly, false);
  });

  test("reads the rights of a room admitted before it attached", () => {
    const room = new FakeRoom();
    room.admit("read");
    const panel = new FakePanel();

    new RoomAccess(room, panel, "texture");

    assert.equal(panel.access.get("texture")?.readOnly, true);
  });

  test("gives each texture the rights of its own room", () => {
    const writable = new FakeRoom();
    const readable = new FakeRoom();
    const panel = new FakePanel();
    new RoomAccess(writable, panel, "a");
    new RoomAccess(readable, panel, "b");

    writable.admit("write");
    readable.admit("read");

    assert.equal(panel.access.get("a")?.has("pixels"), true);
    assert.equal(panel.access.get("b")?.readOnly, true);
  });

  test("announces refused pixel commands but not refused presence", () => {
    const room = new FakeRoom();
    const panel = new FakePanel();
    new RoomAccess(room, panel, "texture");

    room.deny("$presence");
    room.deny("stroke");

    assert.equal(panel.messages.length, 1);
  });

  test("stops following the room once disposed", () => {
    const room = new FakeRoom();
    const panel = new FakePanel();
    new RoomAccess(room, panel, "texture").dispose();

    room.admit("read");
    room.deny("stroke");

    assert.equal(panel.access.get("texture")?.readOnly, false);
    assert.deepEqual(panel.messages, []);
  });
});
