// Import Node.js Dependencies
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  after,
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { WorkspaceDescriptions } from "../../descriptions/WorkspaceDescriptions.ts";

// CONSTANTS
const kRoots: string[] = [];
const kBanner = "<p align=\"center\">\r\n  <img src=\"./docs/banner.png\">\r\n</p>";

type FileTree = Record<string, string>;

function collectProblems(
  files: FileTree,
  descriptions: Record<string, string | undefined> = {
    "packages/net": "Rooms and peers",
    "packages/assets/map": "`.map.json` worlds"
  }
): string[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-descriptions-"));
  kRoots.push(root);
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }

  return [
    ...new WorkspaceDescriptions(
      root,
      Object.entries(descriptions).map(([workspace, description]) => {
        return {
          directory: path.join(root, workspace),
          manifest: {
            name: `@jolly-pixel/${workspace === "packages/net" ? "network" : "asset.map"}`,
            description
          }
        };
      })
    ).problems()
  ];
}

const kAligned: FileTree = {
  "README.md": [
    "- [network](./packages/net) - Rooms and peers",
    "- [asset.map](./packages/assets/map) - `.map.json` worlds",
    ""
  ].join("\n"),
  "packages/net/README.md": `${kBanner}\r\n\r\nRooms and peers\r\n\r\n## About\r\n`,
  "packages/assets/map/README.md": "# Map\n\n`.map.json` worlds\n\n## About\n"
};

describe("WorkspaceDescriptions", () => {
  after(() => {
    for (const root of kRoots) {
      fs.rmSync(root, { recursive: true });
    }
  });

  it("accepts a root README line and a README opening that repeat the package.json description", () => {
    assert.deepStrictEqual(collectProblems(kAligned), []);
  });

  it("reports a root README line or README opening that differs from the description", () => {
    assert.deepStrictEqual(collectProblems({
      ...kAligned,
      "README.md": [
        "- [network](./packages/net) - Rooms, peers and state sync",
        "- [asset.map](./packages/assets/map) - `.map.json` worlds",
        ""
      ].join("\n"),
      "packages/assets/map/README.md": "# Map\n\n## About\n\n`.map.json` worlds\n"
    }), [
      "README.md: the @jolly-pixel/network line differs from its package.json description",
      "packages/assets/map/README.md: the first paragraph differs from the package.json description"
    ]);
  });

  it("reports a workspace without a description or without a root README line", () => {
    assert.deepStrictEqual(collectProblems({
      ...kAligned,
      "README.md": "- [network](./packages/net) - Rooms and peers\n"
    }, {
      "packages/net": undefined,
      "packages/assets/map": "`.map.json` worlds"
    }), [
      "@jolly-pixel/network: package.json has no description",
      "README.md: no \"- [asset.map](./packages/assets/map) - ...\" line for @jolly-pixel/asset.map"
    ]);
  });
});
