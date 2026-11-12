// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Golem } from "#src/peer/Golem.ts";
import { ChatPeer } from "../helpers/ChatPeer.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

// CONSTANTS
const kTimeoutMs = 10_000;

describe("ChatChannel", { timeout: kTimeoutMs }, () => {
  test("hands over what people said since the last call, and nothing from agents", async() => {
    await using backend = await serveStudio();
    const alice = await registered(backend, "Alice");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, alice, "Builder")).value
    });
    using helper = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, alice, "Helper")).value
    });
    using person = await ChatPeer.join(backend, alice);
    await golem.chat.ready;

    await person.chat.say("Add a tower");
    await person.chat.say("Make it red");
    await helper.chat.say("I can help");
    await golem.chat.say("Starting");

    const heard = await golem.chat.next({ timeoutMs: 0 });
    assert.deepEqual(
      heard.map((entry) => [entry.username, entry.text]),
      [["Alice", "Add a tower"], ["Alice", "Make it red"]]
    );
    assert.deepEqual(await golem.chat.next({ timeoutMs: 0 }), []);
  });

  test("waits for the next message when none is unread", async() => {
    await using backend = await serveStudio();
    const alice = await registered(backend, "Alice");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, alice, "Builder")).value
    });
    using person = await ChatPeer.join(backend, alice);
    await golem.chat.ready;

    const next = golem.chat.next({ timeoutMs: kTimeoutMs });
    await person.chat.say("Are you there?");

    assert.deepEqual(
      (await next).map((entry) => entry.text),
      ["Are you there?"]
    );
  });
});
