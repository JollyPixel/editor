// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { readScriptOutline } from "#src/outline/outliner/node.ts";

// CONSTANTS
const kScript = `
import { Behavior, SceneProperty } from "@jolly-pixel/engine";
import * as THREE from "three";

export class PlayerBehavior extends Behavior {
  @SceneProperty({ type: "number", label: "Speed", description: "Units per second" })
  speed = 0.05;

  @SceneProperty({ type: "Vector3" })
  spawn = new THREE.Vector3(1, -2, 3);

  @SceneProperty({ type: "Color" })
  tint = new THREE.Color("#ff8800");

  @SceneProperty({ type: "string[]" })
  tags = ["hero", "blue"];

  @SceneProperty({ type: "Actor" })
  target = null;

  hidden = 3;
}

export class Idle extends Behavior {}

class Helper {
  value = 1;
}
`;

describe("readScriptOutline", () => {
  test("lists behaviors with their declared scene properties and defaults", async() => {
    const outline = await readScriptOutline(kScript);

    assert.deepEqual(outline, {
      behaviors: [
        {
          name: "PlayerBehavior",
          properties: [
            {
              key: "speed",
              type: "number",
              label: "Speed",
              description: "Units per second",
              default: 0.05
            },
            {
              key: "spawn",
              type: "Vector3",
              label: "spawn",
              description: "",
              default: [1, -2, 3]
            },
            {
              key: "tint",
              type: "Color",
              label: "tint",
              description: "",
              default: "#ff8800"
            },
            {
              key: "tags",
              type: "string[]",
              label: "tags",
              description: "",
              default: ["hero", "blue"]
            },
            {
              key: "target",
              type: "Actor",
              label: "target",
              description: "",
              default: null
            }
          ]
        },
        {
          name: "Idle",
          properties: []
        }
      ]
    });
  });

  test("still reads the valid part of a script with syntax errors", async() => {
    const outline = await readScriptOutline(`
      export class Broken extends Behavior {
        @SceneProperty({ type: "boolean" })
        enabled = true;

        update() {
          if (
      }
    `);

    assert.deepEqual(outline?.behaviors[0]?.properties.map(({ key }) => key), ["enabled"]);
  });
});
