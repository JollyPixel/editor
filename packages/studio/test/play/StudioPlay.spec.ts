// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { GameSection } from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  PLAY_CHANGE,
  StudioPlay,
  type StudioPlayOptions
} from "../../src/play/StudioPlay.ts";
import { GAME_CHANGE } from "../../src/project/StudioProjectSettings.ts";

// CONSTANTS
const kRecords = new Map<string, AssetRecordData>([
  ["arena", { id: "arena", kind: "scene", path: "levels/arena.scene.json" }],
  ["menu", { id: "menu", kind: "scene", path: "menu.scene.json" }],
  ["grass", { id: "grass", kind: "texture", path: "grass.png" }]
]);

class FakeProject extends EventTarget {
  game: GameSection;

  constructor(
    start: string | null
  ) {
    super();
    this.game = { start };
  }
}

interface PlayProbe {
  readonly play: StudioPlay;
  readonly project: FakeProject;
  readonly opened: string[];
  readonly failures: string[];
  readonly warnings: string[];
}

function studioPlay(
  options: Partial<StudioPlayOptions> & {
    start?: string | null;
    active?: string | null;
  } = {}
): PlayProbe {
  const opened: string[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];
  const project = new FakeProject(options.start ?? null);
  const play = new StudioPlay({
    catalog: {
      record: (id) => kRecords.get(id)
    },
    project,
    activeAsset: () => options.active ?? null,
    failed: (message) => failures.push(message),
    warned: (message) => warnings.push(message),
    baseUrl: "http://localhost/studio/",
    open: (url, target) => {
      opened.push(`${target} ${url.href}`);

      return options.open?.(url, target) ?? null;
    }
  });

  return {
    play,
    project,
    opened,
    failures,
    warnings
  };
}

describe("StudioPlay", () => {
  test("plays the default scene, else the scene of the active tab", () => {
    const withDefault = studioPlay({ start: "arena", active: "menu" });
    const withoutDefault = studioPlay({ active: "menu" });

    withDefault.play.play("game");
    withoutDefault.play.play("game");

    assert.deepStrictEqual(withDefault.opened, [
      "jolly-play http://localhost/studio/play/?start=arena"
    ]);
    assert.deepStrictEqual(withoutDefault.opened, [
      "jolly-play http://localhost/studio/play/?start=menu"
    ]);
    withDefault.play.dispose();
    withoutDefault.play.dispose();
  });

  test("plays the current scene only from a scene tab", () => {
    const fromScene = studioPlay({ start: "arena", active: "menu" });
    const fromTexture = studioPlay({ start: "arena", active: "grass" });

    assert.strictEqual(fromScene.play.play("scene"), true);
    assert.strictEqual(fromTexture.play.play("scene"), false);

    assert.deepStrictEqual(fromScene.opened, [
      "jolly-play http://localhost/studio/play/?start=menu"
    ]);
    assert.deepStrictEqual(fromTexture.opened, []);
    fromScene.play.dispose();
    fromTexture.play.dispose();
  });

  test("ignores a default scene that is gone or not a scene", () => {
    const { play, opened } = studioPlay({ start: "grass" });

    assert.strictEqual(play.defaultScene, null);
    assert.strictEqual(play.play("game"), false);
    assert.deepStrictEqual(opened, []);
    play.dispose();
  });

  test("announces a change when the default scene changes", () => {
    const { play, project } = studioPlay();
    let changes = 0;
    play.addEventListener(PLAY_CHANGE, () => changes++);

    project.game = { start: "arena" };
    project.dispatchEvent(new Event(GAME_CHANGE));
    play.dispose();
    project.dispatchEvent(new Event(GAME_CHANGE));

    assert.strictEqual(changes, 1);
    assert.strictEqual(play.defaultScene?.id, "arena");
  });

  test("reports the errors of the game window it opened, and no other", () => {
    const { play, failures } = studioPlay({
      start: "arena",
      open: () => window
    });
    const error = {
      type: "jolly-play-error",
      message: "boom"
    };

    window.dispatchEvent(new MessageEvent("message", { data: error }));
    play.play("game");
    window.dispatchEvent(new MessageEvent("message", {
      data: error,
      source: window
    }));
    play.dispose();
    window.dispatchEvent(new MessageEvent("message", {
      data: error,
      source: window
    }));

    assert.deepStrictEqual(failures, ["boom"]);
  });

  test("reports the errors of a game window opened before the studio reloaded", (t) => {
    const { play, failures } = studioPlay({ start: "arena" });
    t.after(() => {
      window.name = "";
      play.dispose();
    });
    window.name = "jolly-play";

    window.dispatchEvent(new MessageEvent("message", {
      data: {
        type: "jolly-play-error",
        message: "boom"
      },
      origin: location.origin,
      source: window
    }));

    assert.deepStrictEqual(failures, ["boom"]);
  });

  test("reports the warnings of its game window apart from its errors", (t) => {
    const { play, failures, warnings } = studioPlay({
      start: "arena",
      open: () => window
    });
    t.after(() => play.dispose());
    play.play("game");

    for (const [type, message] of [
      ["jolly-play-warning", "Missing asset skipped"],
      ["jolly-play-error", "boom"]
    ]) {
      window.dispatchEvent(new MessageEvent("message", {
        data: {
          type,
          message
        },
        source: window
      }));
    }

    assert.deepStrictEqual(warnings, ["Missing asset skipped"]);
    assert.deepStrictEqual(failures, ["boom"]);
  });
});
