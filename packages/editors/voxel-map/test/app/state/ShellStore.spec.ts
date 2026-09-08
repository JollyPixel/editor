// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  ShellStore,
  isSidebarTab,
  isTextureTab
} from "../../../src/app/state/index.ts";

describe("ShellStore", () => {
  it("publishes a tab change only when the tab moves", () => {
    const shell = new ShellStore();
    const tabs: string[] = [];
    shell.watch("tabChange", (tab) => tabs.push(tab));

    shell.tab = "paint";
    shell.tab = "paint";
    shell.tab = "layers";

    assert.deepEqual(tabs, ["paint", "layers"]);
    assert.equal(shell.tab, "layers");
  });

  it("copies the assigned roster and publishes every assignment", () => {
    const shell = new ShellStore();
    let published = 0;
    shell.watch("peersChange", () => published++);

    const source: PresencePeer[] = [
      { clientId: "a", displayName: "Ada", color: "#fff" }
    ];
    shell.peers = source;
    source.push({ clientId: "b", displayName: "Bo", color: "#000" });
    shell.peers = [];

    assert.equal(published, 2);
    assert.equal(shell.peers.length, 0);
  });

  it("recognizes only the known sidebar tabs", () => {
    assert.equal(isSidebarTab("general"), true);
    assert.equal(isSidebarTab("paint"), true);
    assert.equal(isSidebarTab("blocks"), true);
    assert.equal(isSidebarTab("layers"), true);
    assert.equal(isSidebarTab("nope"), false);
  });

  it("hosts the texture editor on the blocks and paint tabs only", () => {
    assert.equal(isTextureTab("blocks"), true);
    assert.equal(isTextureTab("paint"), true);
    assert.equal(isTextureTab("general"), false);
    assert.equal(isTextureTab("layers"), false);
  });
});
