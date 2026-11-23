// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { zipSync } from "fflate";

// Import Internal Dependencies
import { GamePlayerError } from "#src/game/errors/GamePlayerError.ts";
import {
  unzipPlayer,
  zipPlayer
} from "#src/game/PlayerArchive.ts";

describe("PlayerArchive", () => {
  test("restores the page and every file the page loads", () => {
    const bundle = unzipPlayer(zipPlayer({
      page: "<html>play</html>",
      files: new Map([
        ["assets/play.js", new TextEncoder().encode("play()")]
      ])
    }));

    assert.equal(bundle.page, "<html>play</html>");
    assert.deepEqual(
      Array.from(bundle.files, ([name, bytes]) => [name, new TextDecoder().decode(bytes)]),
      [["assets/play.js", "play()"]]
    );
  });

  test("refuses an archive without the play page", () => {
    assert.throws(
      () => unzipPlayer(zipSync({ "assets/play.js": new Uint8Array() })),
      GamePlayerError
    );
  });
});
