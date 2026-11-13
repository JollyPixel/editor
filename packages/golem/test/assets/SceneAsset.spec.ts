// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { SceneCommand } from "@jolly-pixel/asset.scene";

// Import Internal Dependencies
import {
  MAX_BATCH_COMMANDS,
  MAX_UNANSWERED_COMMANDS
} from "#src/assets/GolemAsset.ts";
import { CommandDeniedError } from "#src/assets/errors/CommandDeniedError.ts";
import { CommandInvalidError } from "#src/assets/errors/CommandInvalidError.ts";
import { CommandRefusedError } from "#src/assets/errors/CommandRefusedError.ts";
import { SceneStudio } from "../helpers/SceneStudio.ts";

function renames(
  id: string,
  count: number
): SceneCommand[] {
  return Array.from({ length: count }, (_, index) => {
    return {
      action: "actor-renamed",
      id,
      name: `Sun ${index}`
    };
  });
}

describe("SceneAsset", { timeout: 5_000 }, () => {
  test("rejects settled with the commands the server refused", async() => {
    const studio = new SceneStudio();
    await studio.open();
    const sunId = studio.actorNamed("Sun");
    await studio.server.connect("person");
    await studio.server.receive("person", {
      action: "actor-removed",
      id: sunId,
      clientId: "person",
      seq: 1,
      timestamp: 0
    });

    const [rename] = renames(sunId, 1);
    await studio.scene.apply([rename]);
    await studio.answer();

    const refusal: unknown = await studio.scene.settled().then(
      () => null,
      (error: unknown) => error
    );
    assert.ok(refusal instanceof CommandRefusedError);
    assert.deepEqual(refusal.commands, [rename]);
  });

  test("sends nothing from a batch holding an invalid command", async() => {
    const studio = new SceneStudio();
    await studio.open();
    const sunId = studio.actorNamed("Sun");
    const [rename] = renames(sunId, 1);

    await assert.rejects(
      studio.scene.apply([rename, { action: "actor-renamed", id: "" }]),
      (error: unknown) => error instanceof CommandInvalidError && error.index === 1
    );
    await assert.rejects(
      studio.scene.apply(renames(sunId, MAX_BATCH_COMMANDS + 1)),
      RangeError
    );
    assert.deepEqual(studio.room.sent, []);
  });

  test("fails unanswered commands when the server denies one", async() => {
    const studio = new SceneStudio();
    await studio.open();
    const sunId = studio.actorNamed("Sun");
    await studio.scene.apply(renames(sunId, 1));

    studio.room.emit("denied", {
      event: "actor-renamed",
      reason: "role spectator may only read"
    });

    await assert.rejects(studio.scene.settled(), CommandDeniedError);
    await assert.rejects(
      studio.scene.apply(renames(sunId, 1)),
      CommandDeniedError
    );
  });

  test("holds a batch back while too many commands are unanswered", async() => {
    const studio = new SceneStudio();
    await studio.open();
    const sunId = studio.actorNamed("Sun");
    for (let sent = 0; sent < MAX_UNANSWERED_COMMANDS; sent += MAX_BATCH_COMMANDS) {
      await studio.scene.apply(renames(sunId, MAX_BATCH_COMMANDS));
    }

    let applied = false;
    const held = studio.scene.apply(renames(sunId, 1)).then(() => {
      applied = true;
    });
    await new Promise(setImmediate);
    assert.equal(applied, false);
    assert.equal(studio.room.sent.length, MAX_UNANSWERED_COMMANDS);

    await studio.answer();
    await held;
    assert.equal(studio.room.sent.length, 1);
  });
});
