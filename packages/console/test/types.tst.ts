// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  CommandConsole,
  type ArgValues
} from "#src/index.ts";

declare const commands: CommandConsole;

describe("ArgValues", () => {
  test("a required argument is a required key", () => {
    expect<ArgValues<[{ name: "branch"; type: "string"; required: true; }]>>()
      .type.toBe<{ branch: string; }>();
  });

  test("an optional argument is an optional key", () => {
    expect<ArgValues<[{ name: "branch"; type: "string"; }]>>()
      .type.toBe<{ branch?: string; }>();
  });

  test("number and boolean arguments keep their type", () => {
    expect<ArgValues<[
      { name: "delta"; type: "number"; required: true; },
      { name: "force"; type: "boolean"; }
    ]>>().type.toBe<{ delta: number; force?: boolean; }>();
  });

  test("an enum argument narrows to its values", () => {
    expect<ArgValues<[
      { name: "mode"; type: "enum"; required: true; enumValues: readonly ["a", "b"]; }
    ]>>().type.toBe<{ mode: "a" | "b"; }>();
  });

  test("a rest argument is a string", () => {
    expect<ArgValues<[
      { name: "to"; type: "string"; required: true; },
      { name: "text"; type: "string"; rest: true; }
    ]>>().type.toBe<{ to: string; text?: string; }>();
  });
});

describe("registerCommand", () => {
  test("infers the execute arguments from the declaration", () => {
    commands.registerCommand("grow", {
      description: "",
      args: [
        { name: "delta", type: "number", required: true },
        { name: "axis", type: "enum", enumValues: ["x", "y"] }
      ],
      execute: (args) => {
        expect(args).type.toBe<{ delta: number; axis?: "x" | "y"; }>();
      }
    });
  });
});

describe("registerVariable", () => {
  test("types the setter from the declared type", () => {
    commands.registerVariable("size", {
      type: "number",
      description: "",
      get: () => 1,
      set: (value) => {
        expect(value).type.toBe<number>();
      }
    });
  });

  test("narrows an enum setter to its values", () => {
    commands.registerVariable("mode", {
      type: "enum",
      description: "",
      enumValues: ["add", "remove"],
      get: () => "add",
      set: (value) => {
        expect(value).type.toBe<"add" | "remove">();
      }
    });
  });
});
