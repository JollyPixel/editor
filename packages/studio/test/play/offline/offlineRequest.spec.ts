// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  offlineName,
  playRoute,
  type PlayRouteSource
} from "../../../src/play/offline/offlineRequest.ts";

// CONSTANTS
const kRoot = new URL("https://games.example/studio/");

describe("playRoute", () => {
  test("serves the play page and the game API from the studio root, and nothing else", () => {
    const cases: [PlayRouteSource, string | null][] = [
      [
        { url: "https://games.example/studio/play/?start=a&offline=studio", mode: "navigate" },
        "play/?start=a&offline=studio"
      ],
      [
        { url: "https://games.example/studio/play/index.html", mode: "navigate" },
        "play/index.html"
      ],
      [
        { url: "https://games.example/studio/api/game/builds/a/r/grass.png", mode: "cors" },
        "api/game/builds/a/r/grass.png"
      ],
      [
        { url: "https://games.example/studio/api/game/modules/Player.ts.js?revision=r", mode: "cors" },
        "api/game/modules/Player.ts.js?revision=r"
      ],
      [{ url: "https://games.example/studio/play/sw.js", mode: "navigate" }, null],
      [{ url: "https://games.example/studio/api/game/", mode: "navigate" }, null],
      [{ url: "https://games.example/studio/assets/play.js", mode: "cors" }, null],
      [{ url: "https://games.example/other/api/game/", mode: "cors" }, null],
      [{ url: "https://cdn.example/studio/api/game/", mode: "cors" }, null]
    ];

    for (const [source, expected] of cases) {
      assert.equal(playRoute(source, kRoot), expected, `${source.mode} ${source.url}`);
    }
  });
});

describe("offlineName", () => {
  test("names the offline project of a play page opened offline only", () => {
    assert.equal(offlineName("https://games.example/studio/play/?offline=studio"), "studio");
    assert.equal(offlineName("https://games.example/studio/play/?start=a"), null);
    assert.equal(offlineName("https://games.example/studio/play/?offline="), null);
    assert.equal(offlineName(undefined), null);
  });
});
