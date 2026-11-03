// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ScriptOutline } from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import { scriptForm } from "#src/scene/scriptForm.ts";

// CONSTANTS
const kOutline: ScriptOutline = {
  behaviors: [
    {
      name: "Player",
      properties: [
        { key: "speed", type: "number", label: "Speed", description: "", default: 2 },
        { key: "target", type: "Actor", label: "target", description: "", default: null }
      ]
    },
    {
      name: "Idle",
      properties: []
    }
  ]
};

describe("scriptForm", () => {
  test("offers the script behaviors and declares the picked behavior properties", () => {
    const [behavior, properties] = scriptForm({ behavior: "Player", properties: {} }, kOutline);

    assert.equal(behavior.control, "choice");
    assert.deepEqual(
      behavior.control === "choice" ? behavior.options.map(({ value }) => value) : [],
      ["", "Player", "Idle"]
    );
    assert.deepEqual(
      properties.control === "properties" ? properties.declared?.map(({ key }) => key) : [],
      ["speed"]
    );
  });

  test("keeps a behavior the script no longer declares visible as missing", () => {
    const [behavior] = scriptForm({ behavior: "Removed", properties: {} }, kOutline);

    assert.deepEqual(
      behavior.control === "choice" ? behavior.options.at(-1) : null,
      { value: "Removed", label: "Removed (missing)" }
    );
  });

  test("falls back to a text field while the outline is not loaded", () => {
    const [behavior] = scriptForm({ behavior: "", properties: {} }, null);

    assert.equal(behavior.control, "text");
  });
});
