// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DocsLibrary,
  type DocsPage
} from "../../../src/shell/docs/DocsLibrary.ts";

// CONSTANTS
const kIds = [
  "ecs/README.md",
  "ecs/docs/actor/actor.md",
  "ecs/docs/systems/renderer.md",
  "backend.three/README.md",
  "backend.three/docs/guides/hello-world.md"
];
const kLibrary = new DocsLibrary([
  {
    label: "ECS",
    sections: [
      {
        pages: kIds.map(page)
      }
    ]
  }
]);

function page(
  id: string
): DocsPage {
  return {
    id,
    title: id,
    load: () => Promise.resolve("")
  };
}

function link(
  from: string,
  href: string
): string {
  const source = kLibrary.find(from);
  assert.ok(source !== undefined);
  const target = kLibrary.link(source, href);

  return typeof target === "string" ? target : target.id;
}

describe("DocsLibrary.link", () => {
  const cases: [from: string, href: string, expected: string][] = [
    ["ecs/docs/actor/actor.md", "../systems/renderer.md", "ecs/docs/systems/renderer.md"],
    ["ecs/docs/actor/actor.md", "./actor.md?raw", "ecs/docs/actor/actor.md"],
    [
      "backend.three/README.md",
      "./docs/guides/hello-world.md#next",
      "backend.three/docs/guides/hello-world.md"
    ],
    [
      "backend.three/docs/guides/hello-world.md",
      "../../../ecs/README.md",
      "ecs/README.md"
    ],
    [
      "backend.three/docs/guides/hello-world.md",
      "../../../loop/docs/gameloop.md",
      "missing"
    ],
    ["ecs/README.md", "https://example.com/ecs/README.md", "external"],
    ["ecs/README.md", "./docs/%E0%A4%A.md", "missing"]
  ];

  for (const [from, href, expected] of cases) {
    test(`resolves "${href}" from ${from}`, () => {
      assert.equal(link(from, href), expected);
    });
  }
});
