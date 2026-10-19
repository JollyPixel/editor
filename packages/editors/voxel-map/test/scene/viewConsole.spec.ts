// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { viewConsole } from "../../src/scene/viewConsole.ts";
import { ViewStore } from "../../src/state/ViewStore.ts";

function registerView() {
  const commands = new CommandConsole();
  const view = new ViewStore(new Preferences());
  viewConsole(commands, { state: { view } });

  return {
    commands,
    view
  };
}

describe("view console", () => {
  test("grid shows and hides the ground grid", async() => {
    const { commands, view } = registerView();

    await commands.submit("view.grid off");
    assert.equal(view.settings.grid, false);

    await commands.submit("view.grid on");
    assert.equal(view.settings.grid, true);
  });

  test("inspector and chunkBounds write the view settings", async() => {
    const { commands, view } = registerView();

    await commands.submit("view.inspector wireframe");
    await commands.submit("view.chunkBounds on");

    assert.equal(view.settings.inspector, "wireframe");
    assert.equal(view.settings.chunkBounds, true);
  });
});
