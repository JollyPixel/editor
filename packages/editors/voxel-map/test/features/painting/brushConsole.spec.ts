// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";

// Import Internal Dependencies
import { brushConsole } from "../../../src/features/painting/brushConsole.ts";
import {
  BRUSH_MAX_SIZE,
  BrushStore
} from "../../../src/features/painting/BrushStore.ts";

function registerBrush() {
  const commands = new CommandConsole();
  const brush = new BrushStore();
  const localBrush = {
    skyRadius: 24
  };
  const handle = brushConsole(commands, { brush, localBrush });

  return {
    commands,
    brush,
    localBrush,
    handle
  };
}

function lastLine(
  commands: CommandConsole
): string {
  const entry = commands.scrollback.at(-1);

  return `${entry?.kind}: ${entry?.text}`;
}

describe("brush console", () => {
  test("a write reaches the store and emits its change", async() => {
    const { commands, brush } = registerBrush();
    const sizes: number[] = [];
    brush.subscribe("change", ({ size }) => sizes.push(size));

    await commands.submit("brush.size 3");

    assert.equal(brush.size, 3);
    assert.deepEqual(sizes, [3]);
    assert.equal(lastLine(commands), "info: 3");
  });

  test("an out-of-range size prints the clamped size", async() => {
    const { commands, brush } = registerBrush();

    await commands.submit("brush.size 999");

    assert.equal(brush.size, BRUSH_MAX_SIZE);
    assert.equal(lastLine(commands), `info: ${BRUSH_MAX_SIZE}`);
  });

  test("enum and boolean variables write the store", async() => {
    const { commands, brush } = registerBrush();

    await commands.submit("brush.mode replace");
    await commands.submit("brush.axis XYZ");
    await commands.submit("brush.pattern circle");
    await commands.submit("brush.flipY on");
    await commands.submit("brush.ghost yes");

    assert.equal(brush.mode, "replace");
    assert.equal(brush.axis, "xyz");
    assert.equal(brush.pattern, "circle");
    assert.equal(brush.flipY, true);
    assert.equal(brush.ghost, true);
  });

  test("rotationMode reads and writes degrees", async() => {
    const { commands, brush } = registerBrush();

    await commands.submit("brush.rotationMode");
    assert.equal(lastLine(commands), "info: auto");

    await commands.submit("brush.rotationMode 270");
    assert.equal(brush.rotationMode, 3);
    assert.equal(lastLine(commands), "info: 270");
  });

  test("skyRadius writes the local brush", async() => {
    const { commands, localBrush } = registerBrush();

    await commands.submit("brush.skyRadius 8");

    assert.equal(localBrush.skyRadius, 8);
    assert.equal(lastLine(commands), "info: 8");
  });

  test("a value outside the enum leaves the store unchanged", async() => {
    const { commands, brush } = registerBrush();

    await commands.submit("brush.pattern star");

    assert.equal(brush.pattern, "square");
    assert.equal(commands.scrollback.at(-1)?.kind, "error");
  });

  test("unregister removes the namespace", () => {
    const { commands, handle } = registerBrush();

    handle.unregister();

    assert.equal(commands.registry.namespace("brush"), undefined);
  });
});
