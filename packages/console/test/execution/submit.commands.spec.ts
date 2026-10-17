// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";

function lines(
  commands: CommandConsole
): string[] {
  return commands.scrollback.map((entry) => `${entry.kind}: ${entry.text}`);
}

function withBrush(): { commands: CommandConsole; brush: { size: number; }; } {
  const commands = new CommandConsole();
  const brush = { size: 1 };
  commands.registerNamespace("brush").registerVariable("size", {
    type: "number",
    description: "Brush size",
    get: () => brush.size,
    set: (value) => {
      brush.size = Math.min(Math.max(value, 1), 16);
    }
  });

  return {
    commands,
    brush
  };
}

describe("commands", () => {
  test("arguments are coerced and passed by name", async() => {
    const calls: unknown[] = [];
    const commands = new CommandConsole();
    commands.registerCommand("grow", {
      description: "",
      args: [
        { name: "delta", type: "number", required: true },
        { name: "wrap", type: "boolean" }
      ],
      execute: (args, ctx) => {
        calls.push(args);
        ctx.print("grown");
      }
    });

    await commands.submit("/grow 2");
    await commands.submit("/GROW -1 true");

    assert.deepEqual(calls, [{ delta: 2 }, { delta: -1, wrap: true }]);
    assert.deepEqual(lines(commands).filter((line) => line.startsWith("info")), [
      "info: grown",
      "info: grown"
    ]);
  });

  test("a rest argument takes the remainder of the line", async() => {
    const said: unknown[] = [];
    const commands = new CommandConsole();
    commands.registerCommand("say", {
      description: "",
      args: [
        { name: "to", type: "string", required: true },
        { name: "text", type: "string", rest: true }
      ],
      execute: ({ to, text }) => {
        said.push([to, text]);
      }
    });

    await commands.submit("/say bob hello   \"big\" world");
    await commands.submit("/say bob \"only one\"");
    await commands.submit("/say bob it's \"open");
    await commands.submit("/say bob");

    assert.deepEqual(said, [
      ["bob", "hello   \"big\" world"],
      ["bob", "only one"],
      ["bob", "it's \"open"],
      ["bob", undefined]
    ]);
  });

  test("input errors never reach execute", async() => {
    let called = false;
    const commands = new CommandConsole();
    commands.registerCommand("grow", {
      description: "",
      args: [{ name: "delta", type: "number", required: true }],
      execute: () => {
        called = true;
      }
    });

    await commands.submit("/grow");
    await commands.submit("/grow x");
    await commands.submit("/grow 1 2");
    await commands.submit("/grow \"1");
    await commands.submit("/shrink 1");

    assert.equal(called, false);
    assert.deepEqual(lines(commands).filter((line) => line.startsWith("error")), [
      "error: Missing argument <delta>",
      "error: Expected a number, got \"x\"",
      "error: /grow takes 1 argument(s), got 2",
      "error: Unterminated quote",
      "error: Unknown command \"/shrink\""
    ]);
  });

  test("an unknown command suggests the closest command without running it", async() => {
    let called = false;
    const commands = new CommandConsole();
    const brush = commands.registerNamespace("brush");
    brush.registerCommand("grow", {
      description: "",
      args: [],
      execute: () => {
        called = true;
      }
    });
    brush.registerVariable("size", {
      type: "number",
      description: "",
      get: () => 1,
      set: () => undefined
    });

    await commands.submit("/brush.grwo");
    await commands.submit("/brush.sise");

    assert.equal(called, false);
    assert.deepEqual(lines(commands).filter((line) => line.startsWith("error")), [
      "error: Unknown command \"/brush.grwo\". Did you mean /brush.grow?",
      "error: Unknown command \"/brush.sise\""
    ]);
  });

  test("a mistyped variable suggests the closest one", async() => {
    const { commands } = withBrush();

    await commands.submit("brush.sise");

    assert.equal(
      lines(commands).at(-1),
      "error: \"brush.sise\" is not a variable; commands start with /. Did you mean brush.size?"
    );
  });

  test("a failed line is still recorded in history", async() => {
    const commands = new CommandConsole();

    await commands.submit("/nope");

    assert.deepEqual(commands.history.entries, ["/nope"]);
  });
});

describe("async commands", () => {
  test("the echo entry is pending until the promise settles", async() => {
    const gate = Promise.withResolvers<void>();
    const commands = new CommandConsole();
    commands.registerCommand("fetch", {
      description: "",
      args: [],
      execute: () => gate.promise
    });

    const done = commands.submit("/fetch");

    assert.equal(commands.scrollback[0].pending, true);

    gate.resolve();
    await done;

    assert.equal(commands.scrollback[0].pending, false);
  });

  test("closeOnExecute requests a close only after the promise resolves", async() => {
    const gate = Promise.withResolvers<void>();
    let closes = 0;
    const commands = new CommandConsole();
    commands.on("close-requested", () => closes++);
    commands.registerCommand("go", {
      description: "",
      args: [],
      closeOnExecute: true,
      execute: () => gate.promise
    });

    const done = commands.submit("/go");
    await Promise.resolve();

    assert.equal(closes, 0);

    gate.resolve();
    await done;

    assert.equal(closes, 1);
  });

  test("a rejecting command leaves the console open with an error entry", async() => {
    let closes = 0;
    const commands = new CommandConsole();
    commands.on("close-requested", () => closes++);
    commands.registerCommand("fail", {
      description: "",
      args: [],
      closeOnExecute: true,
      execute: async() => {
        throw new Error("remote refused");
      }
    });

    await commands.submit("/fail");

    assert.equal(closes, 0);
    assert.deepEqual(lines(commands), ["echo: /fail", "error: remote refused"]);
    assert.equal(commands.scrollback[0].pending, false);
  });

  test("unregistering a running command aborts its signal", async() => {
    const gate = Promise.withResolvers<void>();
    let signal: AbortSignal | undefined;
    const commands = new CommandConsole();
    const handle = commands.registerNamespace("net").registerCommand("pull", {
      description: "",
      args: [],
      execute: (_args, ctx) => {
        signal = ctx.signal;

        return gate.promise;
      }
    });

    const done = commands.submit("/net.pull");

    assert.equal(signal?.aborted, false);

    handle.unregister();

    assert.equal(signal?.aborted, true);

    gate.resolve();
    await done;
  });

  test("unregistering the namespace aborts its running commands", async() => {
    const gate = Promise.withResolvers<void>();
    let signal: AbortSignal | undefined;
    const commands = new CommandConsole();
    const net = commands.registerNamespace("net");
    net.registerCommand("pull", {
      description: "",
      args: [],
      execute: (_args, ctx) => {
        signal = ctx.signal;

        return gate.promise;
      }
    });

    const done = commands.submit("/net.pull");
    net.unregister();

    assert.equal(signal?.aborted, true);

    gate.resolve();
    await done;
  });

  test("a finished command's signal is not aborted by a later unregister", async() => {
    let signal: AbortSignal | undefined;
    const commands = new CommandConsole();
    const handle = commands.registerCommand("run", {
      description: "",
      args: [],
      execute: (_args, ctx) => {
        signal = ctx.signal;
      }
    });

    await commands.submit("/run");
    handle.unregister();

    assert.equal(signal?.aborted, false);
  });
});
