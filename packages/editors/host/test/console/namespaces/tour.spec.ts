// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import {
  Lantern,
  Tour
} from "@jolly-pixel/lantern";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { tourConsole } from "#src/console/namespaces/tour.ts";

function tour(
  id: string
): Tour {
  return new Tour({
    id,
    version: 1,
    title: id,
    steps: [
      {
        id: "welcome",
        title: "Welcome",
        body: ""
      }
    ]
  });
}

function registerTours() {
  const commands = new CommandConsole();
  const lantern = new Lantern({ storage: new MemoryStorageAdapter() });
  const basics = tour("editor.basics");
  const brushes = tour("editor.brushes");
  lantern.register(basics);
  lantern.register(brushes);
  tourConsole(commands, { lantern });

  return {
    commands,
    lantern,
    basics,
    brushes
  };
}

function lastLine(
  commands: CommandConsole
): string {
  return commands.scrollback.at(-1)?.text ?? "";
}

describe("tour console", () => {
  test("start runs a registered tour and closes the console", async() => {
    const { commands, lantern, basics } = registerTours();
    let closed = false;
    commands.on("close-requested", () => {
      closed = true;
    });

    await commands.submit("/tour.start editor.basics");

    assert.equal(lantern.current?.tour, basics);
    assert.equal(closed, true);
  });

  test("start prints an error for an unknown id", async() => {
    const { commands, lantern } = registerTours();

    await commands.submit("/tour.start editor.missing");

    assert.match(lastLine(commands), /No tour "editor\.missing" is registered/);
    assert.equal(lantern.current, null);
  });

  test("reset forgets one tour, or every tour without an id", async() => {
    const { commands, lantern, basics, brushes } = registerTours();
    lantern.seen.record(basics);
    lantern.seen.record(brushes);

    await commands.submit("/tour.reset editor.basics");
    assert.equal(lantern.seen.has(basics), false);
    assert.equal(lantern.seen.has(brushes), true);

    await commands.submit("/tour.reset");
    assert.equal(lantern.seen.has(brushes), false);
  });

  test("list marks the tours already taken", async() => {
    const { commands, lantern, basics } = registerTours();
    lantern.seen.record(basics);

    await commands.submit("/tour.list");

    const lines = commands.scrollback.slice(-2).map((entry) => entry.text);
    assert.deepEqual(lines, [
      "editor.basics  editor.basics (seen)",
      "editor.brushes  editor.brushes"
    ]);
  });
});
