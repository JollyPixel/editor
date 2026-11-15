// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PlayerPage } from "#src/game/PlayerPage.ts";

// CONSTANTS
const kPage = [
  "<html><head lang=\"en\">",
  "<script type=\"module\" src=\"/@vite/client\"></script>",
  "<script type=\"importmap\">{\"imports\":{\"three\":\"../assets/three.js\"}}</script>",
  "<script type=\"module\" src=\"../assets/play.js\"></script>",
  "</head></html>"
].join("\n");

describe("PlayerPage", () => {
  test("merges imports into the page's import map, written before any module", () => {
    const page = PlayerPage.parse(kPage).withImports({
      "./modules/a.js": "./modules/a.js?revision=1"
    });

    assert.equal(page.toString(), [
      "<html><head lang=\"en\"><script type=\"importmap\">" +
      "{\"imports\":{\"three\":\"../assets/three.js\"," +
      "\"./modules/a.js\":\"./modules/a.js?revision=1\"}}</script>",
      "<script type=\"module\" src=\"/@vite/client\"></script>",
      "<script type=\"module\" src=\"../assets/play.js\"></script>",
      "</head></html>"
    ].join("\n"));
  });

  test("keeps a project path from closing the import map", () => {
    const page = PlayerPage.parse("<head></head>").withImports({
      "./modules/</script><script>alert(1)</script>.js": "./x.js"
    });

    assert.equal(
      page.toString(),
      "<head><script type=\"importmap\">{\"imports\":" +
      "{\"./modules/\\u003c/script>\\u003cscript>alert(1)\\u003c/script>.js\":" +
      "\"./x.js\"}}</script></head>"
    );
  });

  test("leaves a page without imports as it is", () => {
    const html = "<html><head></head></html>";

    assert.equal(PlayerPage.parse(html).toString(), html);
  });
});
