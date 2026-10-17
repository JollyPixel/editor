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
  ConsoleServer,
  RemoteValueMissingError
} from "#src/index.ts";

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

      return () => {
        brush.size -= delta;
      };
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

  test("writes, reads and reverts a list variable in the frame", async() => {
    const { frame, shell } = await bridge();
    let weights = [1, 2];
    frame.registerNamespace("layers").registerVariable("weights", {
      type: "number[]",
      description: "",
      get: () => weights,
      set: (value) => {
        weights = value;
      }
    });
    await until(() => shell.registry.resolveVariable("layers.weights")?.def.get() !== undefined);

    await shell.submit("layers.weights 3 4.5");
    assert.deepEqual(weights, [3, 4.5]);
    await shell.submit("/revert");

    assert.deepEqual(weights, [1, 2]);
    assert.deepEqual(lines(shell), [
      "echo: layers.weights 3 4.5",
      "info: 3 4.5",
      "echo: /revert",
      "info: Reverted layers.weights 3 4.5"
    ]);
  });

  test("mirrors a nested namespace under its full address, beside the shell's own", async() => {
    const local = new CommandConsole();
    local.registerNamespace("pixelart.local");
    const { frame, shell, conflicts } = await bridge(local);
    let undo = "mod+z";

    frame.registerNamespace("pixelart.keybinds").registerVariable("undo", {
      type: "string",
      description: "Shortcut for undo",
      get: () => undo,
      set: (value) => {
        undo = value;
      }
    });
    await until(() => shell.registry.resolveVariable("pixelart.keybinds.undo") !== undefined);
    await shell.submit("pixelart.keybinds.undo mod+u");

    assert.equal(undo, "mod+u");
    assert.equal(lines(shell).at(-1), "info: mod+u");
    assert.deepEqual(conflicts, []);
  });

  test("a frame getter that throws leaves its mirrored variable without a value", async() => {
    const { frame, shell } = await bridge();

    const probe = frame.registerNamespace("probe");
    probe.registerVariable("ready", {
      type: "boolean",
      description: "",
      get: () => {
        throw new Error("not ready");
      },
      set: () => undefined
    });
    await until(() => shell.registry.resolveVariable("probe.ready") !== undefined);
    const ready = shell.registry.resolveVariable("probe.ready");

    assert.throws(() => ready?.def.get(), RemoteValueMissingError);
    assert.equal(shell.registry.resolveVariable("brush.size")?.def.get(), 1);
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
});
