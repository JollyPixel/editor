// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandConsole,
  type RegistrationHandle
} from "#src/index.ts";

interface Brush {
  size: number;
  mode: "build" | "replace";
}

interface Setup {
  commands: CommandConsole;
  brush: Brush;
  grow: RegistrationHandle;
}

function withBrush(): Setup {
  const commands = new CommandConsole();
  const brush: Brush = {
    size: 1,
    mode: "build"
  };
  const namespace = commands.registerNamespace("brush");
  namespace.registerVariable("size", {
    type: "number",
    description: "",
    get: () => brush.size,
    set: (value) => {
      brush.size = Math.min(Math.max(value, 1), 16);
    }
  });
  namespace.registerVariable("mode", {
    type: "enum",
    description: "",
    enumValues: ["build", "replace"],
    get: () => brush.mode,
    set: (mode) => {
      brush.mode = mode;
    }
  });
  const grow = namespace.registerCommand("grow", {
    description: "",
    args: [
      {
        name: "delta",
        type: "number",
        required: true
      }
    ],
    execute: ({ delta }) => {
      brush.size += delta;

      return () => {
        brush.size -= delta;
      };
    }
  });
  namespace.registerCommand("log", {
    description: "",
    args: [],
    execute: (_args, ctx) => ctx.print(`size ${brush.size}`)
  });

  return {
    commands,
    brush,
    grow
  };
}

async function revert(
  commands: CommandConsole,
  line = "/revert"
): Promise<string[]> {
  const from = commands.scrollback.length;
  await commands.submit(line);

  return commands.scrollback
    .slice(from + 1)
    .map((entry) => `${entry.kind}: ${entry.text}`);
}

describe("/revert", () => {
  test("undoes the newest change first, count changes at a time", async() => {
    const { commands, brush } = withBrush();
    await commands.submit("/brush.grow 2");
    await commands.submit("brush.mode replace");
    await commands.submit("/brush.grow 3");

    assert.deepEqual(await revert(commands, "/revert 2"), [
      "info: Reverted /brush.grow 3",
      "info: Reverted brush.mode replace"
    ]);
    assert.deepEqual(brush, {
      size: 3,
      mode: "build"
    });

    assert.deepEqual(await revert(commands), ["info: Reverted /brush.grow 2"]);
    assert.equal(brush.size, 1);
  });

  test("skips lines that changed nothing or cannot be undone", async() => {
    const { commands, brush } = withBrush();
    await commands.submit("brush.size 4");
    await commands.submit("brush.size");
    await commands.submit("/brush.log");
    await commands.submit("brush.size 4");
    await commands.submit("brush.size 99");
    await commands.submit("brush.size 99");
    await commands.submit("brush.mode nope");
    await commands.submit("/help");

    assert.deepEqual(await revert(commands, "/revert 3"), [
      "info: Reverted brush.size 99",
      "info: Reverted brush.size 4",
      "info: Reverted 2 of 3"
    ]);
    assert.deepEqual(brush, {
      size: 1,
      mode: "build"
    });
  });

  test("restores the items a list held before the write", async() => {
    const tags = ["two words", "b"];
    const commands = new CommandConsole();
    commands.registerVariable("tags", {
      type: "string[]",
      description: "",
      get: () => tags,
      set: (value) => {
        tags.splice(0, tags.length, ...value);
      }
    });
    await commands.submit("tags c d");
    await commands.submit("tags c d");

    assert.deepEqual(await revert(commands, "/revert 2"), [
      "info: Reverted tags c d",
      "info: Reverted 1 of 2"
    ]);
    assert.deepEqual(tags, ["two words", "b"]);
  });

  test("reports when there is nothing to revert", async() => {
    const { commands } = withBrush();

    assert.deepEqual(await revert(commands), ["info: Nothing to revert"]);
  });

  test("rejects a count that is not a positive whole number", async() => {
    const { commands, brush } = withBrush();
    await commands.submit("/brush.grow 2");

    assert.deepEqual(await revert(commands, "/revert 0"), [
      "error: Expected a positive whole number, got 0"
    ]);
    assert.deepEqual(await revert(commands, "/revert 1.5"), [
      "error: Expected a positive whole number, got 1.5"
    ]);
    assert.equal(brush.size, 3);
  });

  test("skips a change whose command or variable is no longer registered", async() => {
    const { commands, brush, grow } = withBrush();
    await commands.submit("brush.mode replace");
    await commands.submit("/brush.grow 2");
    grow.unregister();

    assert.deepEqual(await revert(commands), [
      "error: Skipped /brush.grow 2: /brush.grow is no longer registered",
      "info: Reverted brush.mode replace"
    ]);
    assert.deepEqual(brush, {
      size: 3,
      mode: "build"
    });
  });

  test("stops at a revert that fails and drops it", async() => {
    const { commands, brush } = withBrush();
    await commands.submit("brush.mode replace");
    commands.registerCommand("break", {
      description: "",
      args: [],
      execute: () => () => {
        throw new Error("too late");
      }
    });
    await commands.submit("/break");

    assert.deepEqual(await revert(commands, "/revert 2"), [
      "error: Could not revert /break: too late"
    ]);
    assert.equal(brush.mode, "replace");

    assert.deepEqual(await revert(commands), ["info: Reverted brush.mode replace"]);
  });

  test("waits for an async revert before the next one", async() => {
    const commands = new CommandConsole();
    const events: string[] = [];
    commands.registerCommand("step", {
      description: "",
      args: [
        {
          name: "name",
          type: "string",
          required: true
        }
      ],
      execute: async({ name }) => async() => {
        await Promise.resolve();
        events.push(name);
      }
    });
    await commands.submit("/step a");
    await commands.submit("/step b");

    await commands.submit("/revert 2");

    assert.deepEqual(events, ["b", "a"]);
  });

  test("keeps the last 100 changes", async() => {
    const { commands } = withBrush();
    for (let index = 0; index < 101; index++) {
      await commands.submit("/brush.grow 1");
    }

    assert.deepEqual(
      (await revert(commands, "/revert 101")).at(-1),
      "info: Reverted 100 of 101"
    );
  });
});
