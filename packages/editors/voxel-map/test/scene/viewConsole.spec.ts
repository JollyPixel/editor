// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";

// Import Internal Dependencies
import {
  viewConsole,
  type ViewConsoleContext
} from "../../src/scene/viewConsole.ts";

function registerView() {
  const commands = new CommandConsole();
  const grid = {
    enabled: true
  };
  const inspector: ViewConsoleContext["inspector"] = {
    mode: "off",
    chunkBounds: false
  };
  viewConsole(commands, { grid, inspector });

  return {
    commands,
    grid,
    inspector
  };
}

describe("view console", () => {
  test("grid shows and hides the ground grid", async() => {
    const { commands, grid } = registerView();

    await commands.submit("view.grid off");
    assert.equal(grid.enabled, false);

    await commands.submit("view.grid on");
    assert.equal(grid.enabled, true);
  });

  test("inspector and chunkBounds write the voxel inspector", async() => {
    const { commands, inspector } = registerView();

    await commands.submit("view.inspector wireframe");
    await commands.submit("view.chunkBounds on");

    assert.equal(inspector.mode, "wireframe");
    assert.equal(inspector.chunkBounds, true);
  });
});
