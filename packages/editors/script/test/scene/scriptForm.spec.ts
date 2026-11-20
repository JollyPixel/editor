// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ScriptOutline } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import {
  scriptForm,
  scriptSignals
} from "#src/scene/scriptForm.ts";

// CONSTANTS
const kOutline: ScriptOutline = {
  behaviors: [
    {
      name: "Player",
      properties: [
        { key: "speed", type: "number", label: "Speed", description: "", default: 2 },
        { key: "target", type: "Actor", label: "target", description: "", default: null },
        { key: "jump", type: "Sound", label: "Jump sound", description: "", default: null }
      ],
      signals: [{ key: "jumped", params: [{ name: "height", type: "number" }] }],
      methods: [{ key: "jump", params: [] }]
    },
    {
      name: "Idle",
      properties: [],
      signals: [],
      methods: []
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

  test("picks the sound of a Sound property from its own asset slot", () => {
    const [, , jump, ...rest] = scriptForm({ behavior: "Player", properties: {} }, kOutline);

    assert.deepEqual(rest, []);
    assert.equal(jump.control, "asset");
    assert.deepEqual(
      jump.control === "asset" ? [jump.slot, jump.label, jump.type.kind.value] : [],
      ["property:jump", "Jump sound", "sound"]
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

describe("scriptSignals", () => {
  test("lists the signals and methods of the picked behavior", () => {
    const signals = scriptSignals({ behavior: "Player", properties: {} }, kOutline);

    assert.deepEqual(signals, {
      signals: [{ key: "jumped", params: [{ name: "height", type: "number" }] }],
      methods: [{ key: "jump", params: [] }]
    });
  });

  test("lists nothing for a behavior the script no longer declares", () => {
    const signals = scriptSignals({ behavior: "Removed", properties: {} }, kOutline);

    assert.deepEqual(signals, { signals: [], methods: [] });
  });

  test("knows no signals while the outline is not loaded", () => {
    assert.equal(scriptSignals({ behavior: "Player", properties: {} }, null), null);
  });
});
