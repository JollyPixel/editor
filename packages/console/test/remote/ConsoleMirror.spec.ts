// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  CommandConsole,
  ConsoleMirror,
  ConsoleServer
} from "#src/index.ts";
import { complete } from "#src/search/complete.ts";

interface FrameBrush {
  size: number;
  aborted: boolean;
}

interface Bridge {
  frame: CommandConsole;
  shell: CommandConsole;
  brush: FrameBrush;
  server: ConsoleServer;
  mirror: ConsoleMirror;
  conflicts: string[];
}

const closers: Array<() => void> = [];

afterEach(() => {
  for (const close of closers.splice(0)) {
    close();
  }
});

function frameConsole(
  brush: FrameBrush
): CommandConsole {
  const commands = new CommandConsole();
  const namespace = commands.registerNamespace("brush", {
    description: "Voxel brush"
  });
  namespace.registerVariable("size", {
    type: "number",
    description: "Brush size",
    get: () => brush.size,
    set: (size) => {
      if (size < 0) {
        return false;
      }
      brush.size = Math.min(size, 16);

      return undefined;
    }
  });
  namespace.registerVariable("mode", {
    type: "enum",
    description: "Brush mode",
    enumValues: ["build", "replace"],
    get: () => "build",
    set: () => {
      throw new Error("mode is locked");
    }
  });
  namespace.registerCommand("grow", {
    description: "Grow the brush",
    args: [
      {
        name: "delta",
        type: "number",
        required: true
      }
    ],
    execute: ({ delta }, ctx) => {
      brush.size += delta;
      ctx.print(`brush size ${brush.size}`);
      ctx.error("clamped");
    }
  });
  namespace.registerCommand("fail", {
    description: "Always fails",
    args: [],
    execute: () => {
      throw new Error("brush is busy");
    }
  });
  namespace.registerCommand("wait", {
    description: "Runs until cancelled",
    args: [],
    execute: (_args, ctx) => new Promise<void>((resolve) => {
      ctx.signal.addEventListener("abort", () => {
        brush.aborted = true;
        resolve();
      });
    })
  });
  namespace.registerCommand("pick", {
    description: "Pick a block",
    args: [
      {
        name: "block",
        type: "string",
        autocomplete: () => ["grass", "stone"]
      }
    ],
    execute: () => undefined
  });

  return commands;
}

async function until(
  predicate: () => boolean
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) {
      return;
    }
    await setImmediate();
  }
  assert.fail("condition never held");
}

async function bridge(
  shell = new CommandConsole()
): Promise<Bridge> {
  const brush: FrameBrush = {
    size: 1,
    aborted: false
  };
  const frame = frameConsole(brush);
  const channel = new MessageChannel();
  const conflicts: string[] = [];
  const server = new ConsoleServer(frame, channel.port1);
  const mirror = new ConsoleMirror(channel.port2, shell, {
    onConflict: (namespace) => conflicts.push(namespace)
  });
  closers.push(() => {
    mirror.close();
    server.close();
  });
  mirror.active = true;
  await until(() => shell.registry.namespace("brush") !== undefined);

  return {
    frame,
    shell,
    brush,
    server,
    mirror,
    conflicts
  };
}

function lines(
  commands: CommandConsole
): string[] {
  return commands.scrollback.map((entry) => `${entry.kind}: ${entry.text}`);
}

describe("ConsoleMirror", () => {
  test("registers the frame's namespaces but not its root commands", async() => {
    const shell = new CommandConsole();
    const rootCommands = [...shell.registry.root.commands()].length;

    await bridge(shell);

    assert.deepEqual(
      [...shell.registry.namespaces()].map((namespace) => namespace.name),
      ["brush"]
    );
    assert.equal(shell.registry.namespace("brush")?.description, "Voxel brush");
    assert.equal([...shell.registry.root.commands()].length, rootCommands);
  });

  test("runs a command in the frame and streams its output", async() => {
    const { shell, brush } = await bridge();

    await shell.submit("/brush.grow 3");

    assert.equal(brush.size, 4);
    assert.deepEqual(lines(shell), [
      "echo: /brush.grow 3",
      "info: brush size 4",
      "error: clamped"
    ]);
  });

  test("prints the message of a command that fails in the frame", async() => {
    const { shell } = await bridge();

    await shell.submit("/brush.fail");

    assert.deepEqual(lines(shell), [
      "echo: /brush.fail",
      "error: brush is busy"
    ]);
  });

  test("writes a variable in the frame and prints the value read back", async() => {
    const { shell, brush } = await bridge();

    await shell.submit("brush.size 99");
    await shell.submit("brush.size -1");
    await shell.submit("brush.mode replace");

    assert.equal(brush.size, 16);
    assert.deepEqual(lines(shell), [
      "echo: brush.size 99",
      "info: 16",
      "echo: brush.size -1",
      "error: brush.size rejected \"-1\"",
      "echo: brush.mode replace",
      "error: mode is locked"
    ]);
  });

  test("reads the value a frame command changed", async() => {
    const { shell } = await bridge();

    await shell.submit("/brush.grow 2");
    await until(() => shell.registry.resolveVariable("brush.size")?.def.get() === 3);
    await shell.submit("brush.size");

    assert.equal(lines(shell).at(-1), "info: 3");
  });

  test("refreshes values when the console opens", async() => {
    const { shell, brush } = await bridge();
    const size = shell.registry.resolveVariable("brush.size");

    brush.size = 7;
    shell.emit("opened");
    await until(() => size?.def.get() === 7);

    assert.equal(shell.registry.resolveVariable("brush.size"), size);
  });

  test("asks the frame for argument completions", async() => {
    const { shell } = await bridge();

    const list = await complete("/brush.pick ", 12, shell.registry);

    assert.deepEqual(list.items.map((item) => item.value), ["grass", "stone"]);
  });

  test("follows namespaces the frame registers and removes later", async() => {
    const { frame, shell } = await bridge();

    const layers = frame.registerNamespace("layers");
    layers.registerCommand("add", {
      description: "Add a layer",
      args: [],
      execute: () => undefined
    });
    await until(() => shell.registry.resolveCommand("layers.add") !== undefined);
    layers.unregister();
    await until(() => shell.registry.namespace("layers") === undefined);

    assert.ok(shell.registry.namespace("brush"));
  });

  test("deactivating removes the namespaces and cancels a running command", async() => {
    const { shell, brush, mirror } = await bridge();

    const running = shell.submit("/brush.wait");
    await setImmediate();
    mirror.active = false;
    await running;
    await until(() => brush.aborted);

    assert.equal(shell.registry.namespace("brush"), undefined);
    assert.equal(lines(shell).at(-1), "error: /brush.wait was cancelled");
  });

  test("closing cancels a command the frame never answered", async() => {
    const { shell, server, mirror } = await bridge();
    server.close();

    const running = shell.submit("/brush.grow 1");
    mirror.close();
    await running;

    assert.equal(lines(shell).at(-1), "error: /brush.grow was cancelled");
  });

  test("keeps a namespace the shell already owns", async() => {
    const shell = new CommandConsole();
    shell.registerNamespace("brush").registerVariable("size", {
      type: "number",
      description: "Shell brush",
      get: () => 42,
      set: () => undefined
    });

    const { frame, conflicts } = await bridge(shell);
    await until(() => conflicts.length > 0);
    frame.registerNamespace("layers");
    await until(() => shell.registry.namespace("layers") !== undefined);

    assert.deepEqual(conflicts, ["brush"]);
    assert.equal(shell.registry.resolveVariable("brush.size")?.def.get(), 42);
  });

  test("reports a conflict once across activations", async() => {
    const shell = new CommandConsole();
    shell.registerNamespace("brush");

    const { mirror, conflicts } = await bridge(shell);
    await until(() => conflicts.length > 0);
    mirror.active = false;
    mirror.active = true;

    assert.deepEqual(conflicts, ["brush"]);
  });

  test("an inactive mirror registers nothing until it is activated", async() => {
    const brush: FrameBrush = {
      size: 5,
      aborted: false
    };
    const shell = new CommandConsole();
    const channel = new MessageChannel();
    const server = new ConsoleServer(frameConsole(brush), channel.port1);
    const mirror = new ConsoleMirror(channel.port2, shell);
    closers.push(() => {
      mirror.close();
      server.close();
    });

    await setImmediate();
    assert.equal(shell.registry.namespace("brush"), undefined);

    mirror.active = true;
    await until(() => shell.registry.namespace("brush") !== undefined);

    assert.equal(shell.registry.resolveVariable("brush.size")?.def.get(), 5);
  });
});
