// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { ScriptOutlineFeed } from "#src/network/ScriptOutlineFeed.ts";
import type { ScriptOutline } from "#src/outline/ScriptOutline.schema.ts";
import { ScriptSession } from "../helpers/ScriptSession.ts";

describe("script outline relay", () => {
  test("an outline request reaches every peer and reads each text once", async() => {
    const read: string[] = [];
    const session = new ScriptSession("class A {}", {
      readOutline: (text) => {
        read.push(text);

        return Promise.resolve({
          behaviors: [{ name: "A", properties: [] }]
        });
      }
    });
    const alice = await session.join("A");
    const bob = await session.join("B");
    const aliceFeed = new ScriptOutlineFeed(alice.room);
    const bobFeed = new ScriptOutlineFeed(bob.room);
    const received: ScriptOutline[] = [];
    bobFeed.on("change", (outline) => received.push(outline));

    aliceFeed.request();
    aliceFeed.request();
    await session.upload(alice);
    await setImmediate();
    session.deliver(alice);
    session.deliver(bob);

    assert.deepEqual(read, ["class A {}"]);
    assert.equal(received.length, 2);
    assert.deepEqual(aliceFeed.outline, {
      behaviors: [{ name: "A", properties: [] }]
    });
  });
});
