// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type {
  DockColumn,
  PanePlacement
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  resolveTextureHost,
  texturePanesGrouped,
  textureUvAccess
} from "../../../src/app/panels/textureHost.ts";

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

describe("resolveTextureHost", () => {
  it("follows the shown tab when Blocks and Paint share a group", () => {
    assert.equal(
      resolveTextureHost(placed("left", 0, true), placed("left", 0, false), "paint"),
      "blocks"
    );
    assert.equal(
      resolveTextureHost(placed("left", 0, false), placed("left", 0, true), "blocks"),
      "paint"
    );
  });

  it("keeps the current host while another tab of the group is shown", () => {
    assert.equal(
      resolveTextureHost(placed("left", 0, false), placed("left", 0, false), "blocks"),
      "blocks"
    );
    assert.equal(
      resolveTextureHost(placed("left", 0, false), placed("left", 0, false), "paint"),
      "paint"
    );
  });

  it("gives the editor to Paint once they no longer share a group", () => {
    assert.equal(
      resolveTextureHost(placed("left", 0, true), placed("right", 0, true), "blocks"),
      "paint"
    );
    assert.equal(
      resolveTextureHost(placed("left", 0, true), placed("left", 1, true), "blocks"),
      "paint"
    );
  });

  it("gives the editor to Paint when they sit in separate columns of one dock", () => {
    assert.equal(
      resolveTextureHost(
        placed("left", 0, true),
        placed("left", 0, true, "secondary"),
        "blocks"
      ),
      "paint"
    );
  });

  it("gives the editor to Paint when either pane floats", () => {
    assert.equal(resolveTextureHost(null, placed("left", 0, true), "blocks"), "paint");
    assert.equal(resolveTextureHost(placed("left", 0, true), null, "blocks"), "paint");
  });
});

describe("texturePanesGrouped", () => {
  it("is true only when Blocks and Paint share a group", () => {
    assert.equal(
      texturePanesGrouped(placed("left", 0, true), placed("left", 0, false)),
      true
    );
    assert.equal(
      texturePanesGrouped(
        placed("left", 0, true),
        placed("left", 0, true, "secondary")
      ),
      false
    );
    assert.equal(
      texturePanesGrouped(placed("left", 0, true), placed("left", 1, true)),
      false
    );
    assert.equal(texturePanesGrouped(null, placed("left", 0, true)), false);
  });
});

describe("textureUvAccess", () => {
  it("lets Paint only view UV regions while it shares a group with Blocks", () => {
    assert.equal(textureUvAccess("paint", true), "view");
    assert.equal(textureUvAccess("blocks", true), "edit");
  });

  it("lets Paint edit UV regions once it has its own group", () => {
    assert.equal(textureUvAccess("paint", false), "edit");
  });
});
