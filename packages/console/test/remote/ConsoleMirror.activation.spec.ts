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
  afterEach(() => {
    for (const close of closers.splice(0)) {
      close();
    }
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

  test("/revert undoes frame commands and variable writes in the frame", async() => {
    const { shell, brush } = await bridge();
    await shell.submit("/brush.grow 3");
    await shell.submit("brush.size 10");

    await shell.submit("/revert 2");

    assert.equal(brush.size, 1);
    assert.deepEqual(lines(shell).slice(-2), [
      "info: Reverted brush.size 10",
      "info: Reverted /brush.grow 3"
    ]);
    await until(() => shell.registry.resolveVariable("brush.size")?.def.get() === 1);
  });

  test("the frame refuses to revert a command replaced since it ran", async() => {
    const { frame, shell } = await bridge();
    const marks: string[] = [];
    const tools = frame.registerNamespace("tools");
    function registerMark(): void {
      tools.registerCommand("mark", {
        description: "",
        args: [],
        execute: () => {
          marks.push("mark");

          return () => {
            marks.pop();
          };
        }
      });
    }
    registerMark();
    await until(() => shell.registry.resolveCommand("tools.mark") !== undefined);
    await shell.submit("/tools.mark");

    registerMark();
    await shell.submit("/revert");

    assert.deepEqual(marks, ["mark"]);
    assert.equal(
      lines(shell).at(-1),
      "error: Could not revert /tools.mark: /tools.mark can no longer be reverted"
    );
  });
});
