// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";
import {
  search,
  select
} from "#src/search/search.ts";

function createConsole(): CommandConsole {
  const commands = new CommandConsole();
  const brush = commands.registerNamespace("brush", { description: "Voxel brush" });
  brush.registerVariable("size", {
    type: "number",
    description: "Brush size in voxels",
    get: () => 1,
    set: () => undefined
  });
  brush.registerVariable("shape", {
    type: "enum",
    enumValues: ["cube", "sphere"],
    description: "Brush shape",
    get: () => "cube",
    set: () => undefined
  });
  brush.registerCommand("grow", {
    description: "Grow or shrink the brush",
    args: [{ name: "delta", type: "number", required: true }],
    execute: () => undefined
  });
  brush.registerCommand("reset", {
    description: "Restore the default size",
    args: [],
    execute: () => undefined
  });
  commands.registerVariable("theme", {
    type: "enum",
    enumValues: ["dark", "light"],
    description: "Editor colour scheme",
    get: () => "dark",
    set: () => undefined
  });

  return commands;
}

describe("search", () => {
  const { registry } = createConsole();

  test("an empty query returns nothing", () => {
    assert.deepEqual(search("  ", registry), []);
  });

  test("ranks by tier across kinds", () => {
    const [first, ...rest] = search("brush", registry);

    assert.equal(first.label, "brush");
    assert.equal(first.tier, 1);
    assert.equal(rest.length, 4);
    assert.ok(rest.every((result) => result.tier === 2));
  });

  test("camelCase and word humps find a variable", () => {
    const labels = search("bs", registry).map((result) => result.label);

    assert.deepEqual(labels.slice(0, 2), ["brush.size", "brush.shape"]);
  });

  test("a name match ranks above a description match", () => {
    const labels = search("size", registry).map((result) => result.label);

    assert.deepEqual(labels, ["brush.size", "/brush.reset"]);
    assert.equal(search("size", registry)[1].field, "description");
  });

  test("description matches never use scattered subsequences", () => {
    assert.deepEqual(search("zzq", registry), []);
    assert.ok(search("colour", registry).some((result) => result.label === "theme"));
  });

  test("command ranges point into the label past the slash", () => {
    const result = search("grow", registry).find((item) => item.label === "/brush.grow");

    assert.deepEqual(result?.ranges, [{ start: 7, end: 11 }]);
  });
});

describe("select", () => {
  const { registry } = createConsole();

  function pick(label: string) {
    const query = label.replace(/^\//, "");
    const result = search(query, registry)
      .find((item) => item.label === label);
    assert.ok(result);

    return select(result);
  }

  test("a command without required arguments runs", () => {
    assert.deepEqual(pick("/brush.reset"), { text: "/brush.reset", run: true });
  });

  test("a command with a required argument is inserted for completion", () => {
    assert.deepEqual(pick("/brush.grow"), { text: "/brush.grow ", run: false });
  });

  test("a variable inserts its address", () => {
    assert.deepEqual(pick("brush.size"), { text: "brush.size", run: false });
  });

  test("a namespace inserts its prefix", () => {
    assert.deepEqual(pick("brush"), { text: "brush.", run: false });
  });
});
