// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type {
  DockColumn,
  PanePlacement
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { TextureHost } from "../../src/shell/TextureHost.ts";

function placed(
  dock: string,
  index: number,
  active: boolean,
  column: DockColumn = "primary"
): PanePlacement {
  return {
    dock,
    column,
    index,
    count: 2,
    group: ["blocks", "paint"],
    active
  };
}

describe("TextureHost.resolve", () => {
  it("follows the shown tab when Blocks and Paint share a group", () => {
    assert.equal(
      TextureHost.resolve(placed("left", 0, true), placed("left", 0, false), "paint").panel,
      "blocks"
    );
    assert.equal(
      TextureHost.resolve(placed("left", 0, false), placed("left", 0, true), "blocks").panel,
      "paint"
    );
  });

  it("keeps the current host while another tab of the group is shown", () => {
    assert.equal(
      TextureHost.resolve(placed("left", 0, false), placed("left", 0, false), "blocks").panel,
      "blocks"
    );
    assert.equal(
      TextureHost.resolve(placed("left", 0, false), placed("left", 0, false), "paint").panel,
      "paint"
    );
  });

  it("gives the editor to Paint once they no longer share a group", () => {
    assert.equal(
      TextureHost.resolve(placed("left", 0, true), placed("right", 0, true), "blocks").panel,
      "paint"
    );
    assert.equal(
      TextureHost.resolve(placed("left", 0, true), placed("left", 1, true), "blocks").panel,
      "paint"
    );
  });

  it("gives the editor to Paint when they sit in separate columns of one dock", () => {
    assert.equal(
      TextureHost.resolve(placed("left", 0, true), placed("left", 0, true, "secondary"), "blocks").panel,
      "paint"
    );
  });

  it("gives the editor to Paint when either pane floats", () => {
    assert.equal(TextureHost.resolve(null, placed("left", 0, true), "blocks").panel, "paint");
    assert.equal(TextureHost.resolve(placed("left", 0, true), null, "blocks").panel, "paint");
  });
});

describe("TextureHost.grouped", () => {
  it("is true only when Blocks and Paint share a group", () => {
    assert.equal(
      TextureHost.resolve(placed("left", 0, true), placed("left", 0, false), "blocks").grouped,
      true
    );
    assert.equal(
      TextureHost.resolve(placed("left", 0, true), placed("left", 0, true, "secondary"), "blocks").grouped,
      false
    );
    assert.equal(
      TextureHost.resolve(placed("left", 0, true), placed("left", 1, true), "blocks").grouped,
      false
    );
    assert.equal(TextureHost.resolve(null, placed("left", 0, true), "blocks").grouped, false);
  });
});

describe("TextureHost.uvAccess", () => {
  it("lets Paint only view UV regions while it shares a group with Blocks", () => {
    assert.equal(new TextureHost("paint", true).uvAccess, "view");
    assert.equal(new TextureHost("blocks", true).uvAccess, "edit");
  });

  it("lets Paint edit UV regions once it has its own group", () => {
    assert.equal(new TextureHost("paint", false).uvAccess, "edit");
  });
});
