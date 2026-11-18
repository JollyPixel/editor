// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CommandDeniedError,
  CommandInvalidError,
  CommandRefusedError,
  MAX_BATCH_COMMANDS,
  MAX_UNANSWERED_COMMANDS
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import type { SceneCommand } from "#src/network/types.ts";
import {
  actorNamed,
  openScene,
  type OpenedScene
} from "../helpers/golem.ts";

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

describe("SceneAsset", () => {
  test("rejects settled with the commands the studio refused", async() => {
    const { scene, hosted } = await openScene();
    const sunId = actorNamed(scene, "Sun");
    await hosted.room.receive({
      action: "actor-removed",
      id: sunId
    });

    const [rename] = renames(sunId, 1);
    await scene.apply([rename]);

    const refusal: unknown = await scene.settled().then(
      () => null,
      (error: unknown) => error
    );
    assert.ok(refusal instanceof CommandRefusedError);
    assert.deepEqual(refusal.commands, [rename]);
  });

  test("sends nothing from a batch holding an invalid command", async() => {
    const { scene, hosted } = await openScene();
    const sunId = actorNamed(scene, "Sun");
    const [rename] = renames(sunId, 1);

    await assert.rejects(
      scene.apply([rename, { action: "actor-renamed", id: "" }]),
      (error: unknown) => error instanceof CommandInvalidError && error.index === 1
    );
    await assert.rejects(
      scene.apply(renames(sunId, MAX_BATCH_COMMANDS + 1)),
      RangeError
    );
    assert.deepEqual(hosted.room.sent, []);
  });

  test("fails unanswered commands when the studio denies one", async() => {
    const { scene, hosted } = await openScene();
    const sunId = actorNamed(scene, "Sun");
    hosted.room.holdAnswers();
    await scene.apply(renames(sunId, 1));

    hosted.room.deny("actor-renamed", "role spectator may only read");

    await assert.rejects(scene.settled(), CommandDeniedError);
    await assert.rejects(
      scene.apply(renames(sunId, 1)),
      CommandDeniedError
    );
  });

  test("holds a batch back while too many commands are unanswered", async() => {
    const { scene, hosted } = await openScene();
    const sunId = await fillUnanswered(scene, hosted);

    let applied = false;
    const held = scene.apply(renames(sunId, 1)).then(() => {
      applied = true;
    });
    await new Promise(setImmediate);
    assert.equal(applied, false);
    assert.equal(hosted.room.sent.length, MAX_UNANSWERED_COMMANDS);

    await hosted.room.answer();
    await held;
    assert.equal(hosted.room.sent.length, MAX_UNANSWERED_COMMANDS + 1);
  });

  test("denies a held batch when the rights change while it waits", async() => {
    const { scene, hosted } = await openScene();
    const sunId = await fillUnanswered(scene, hosted);

    const held = scene.apply(renames(sunId, 1));
    hosted.room.access = "read";
    await hosted.room.answer();

    await assert.rejects(held, CommandDeniedError);
    assert.equal(hosted.room.sent.length, MAX_UNANSWERED_COMMANDS);
  });
});

async function fillUnanswered(
  scene: OpenedScene["scene"],
  hosted: OpenedScene["hosted"]
): Promise<string> {
  const sunId = actorNamed(scene, "Sun");
  hosted.room.holdAnswers();
  for (let sent = 0; sent < MAX_UNANSWERED_COMMANDS; sent += MAX_BATCH_COMMANDS) {
    await scene.apply(renames(sunId, MAX_BATCH_COMMANDS));
  }

  return sunId;
}
