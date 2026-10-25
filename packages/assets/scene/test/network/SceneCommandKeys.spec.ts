// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  sceneConflictKeys,
  sceneWriteKeys
} from "#src/network/SceneCommandKeys.ts";
import { SceneTransform } from "#src/model/SceneTransform.ts";
import type { SceneCommand } from "#src/network/types.ts";
import {
  actor,
  component,
  loadedTree,
  sampleActors
} from "../helpers/scene.ts";

function transformKeys(
  id: string
): string[] {
  return [
    `transform:${id}:position`,
    `transform:${id}:rotation`,
    `transform:${id}:scale`
  ];
}

function actorKeys(
  id: string
): string[] {
  return [
    `name:${id}`,
    `visible:${id}`,
    `parent:${id}`,
    ...transformKeys(id),
    `components:${id}`
  ];
}

describe("sceneConflictKeys", () => {
  const cases: [SceneCommand, string[]][] = [
    [{ action: "actor-added", actors: [actor("D")] }, []],
    [{ action: "actor-renamed", id: "A", name: "X" }, ["name:A"]],
    [{ action: "actor-visibility", id: "A", visible: false }, ["visible:A"]],
    [
      { action: "actor-transformed", id: "A", transform: { scale: { x: 2, y: 2, z: 2 } } },
      ["transform:A:scale"]
    ],
    [
      { action: "actor-moved", id: "A", parentId: "C", transform: SceneTransform.create() },
      ["parent:A", ...transformKeys("A")]
    ],
    [{ action: "component-added", actorId: "A", component: component("c") }, ["components:A"]],
    [{ action: "component-moved", actorId: "A", id: "c" }, ["components:A"]],
    [
      { action: "component-changed", id: "c", data: { color: "#000000" }, unset: ["range"] },
      ["component:c:color", "component:c:range"]
    ],
    [
      { action: "component-assets-changed", id: "c", assets: { map: null } },
      ["component-asset:c:map"]
    ],
    [
      { action: "environment-changed", environment: { background: null, fog: { kind: "none" } } },
      ["environment:background", "environment:fog"]
    ],
    [{ action: "actor-removed", id: "A" }, actorKeys("A")]
  ];

  for (const [command, expected] of cases) {
    test(`keys ${command.action} by ${expected.join(", ") || "nothing"}`, () => {
      assert.deepEqual(sceneConflictKeys(command, []), expected);
    });
  }

  test("keys an actor removal by every value of the subtree it erases", () => {
    const command: SceneCommand = { action: "actor-removed", id: "A" };
    const keys = sceneConflictKeys(command, loadedTree(sampleActors()).erasedBy(command));

    assert.deepEqual(keys, [
      ...actorKeys("A"),
      "component:light:intensity",
      "component:light:color",
      "component-asset:light:cookie",
      ...actorKeys("B")
    ]);
  });

  test("keys a component removal by its list and the values it erases", () => {
    const command: SceneCommand = { action: "component-removed", actorId: "A", id: "light" };
    const keys = sceneConflictKeys(command, loadedTree(sampleActors()).erasedBy(command));

    assert.deepEqual(keys, [
      "components:A",
      "component:light:intensity",
      "component:light:color",
      "component-asset:light:cookie"
    ]);
  });
});

describe("sceneWriteKeys", () => {
  const structural: SceneCommand[] = [
    { action: "actor-added", actors: [actor("D")] },
    { action: "actor-removed", id: "A" },
    { action: "actor-moved", id: "A", parentId: null, transform: SceneTransform.create() },
    { action: "component-added", actorId: "A", component: component("c") },
    { action: "component-removed", actorId: "A", id: "c" },
    { action: "component-moved", actorId: "A", id: "c" }
  ];

  for (const command of structural) {
    test(`leaves ${command.action} to a rebase`, () => {
      assert.equal(sceneWriteKeys(command), null);
    });
  }

  test("keys a value write as the room does", () => {
    const command: SceneCommand = { action: "component-changed", id: "c", data: { a: 1 } };

    assert.deepEqual(sceneWriteKeys(command), sceneConflictKeys(command, []));
  });
});
