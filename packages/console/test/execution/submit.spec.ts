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

describe("variables", () => {
  test("a read prints the value", async() => {
    const { commands } = withBrush();

    await commands.submit("brush.size");

    assert.deepEqual(lines(commands), ["echo: brush.size", "info: 1"]);
  });

  test("a write prints the value read back after the setter", async() => {
    const { commands, brush } = withBrush();

    await commands.submit("brush.size 999");

    assert.equal(brush.size, 16);
    assert.deepEqual(lines(commands), ["echo: brush.size 999", "info: 16"]);
  });

  test("a literal that does not coerce leaves the variable untouched", async() => {
    const { commands, brush } = withBrush();

    await commands.submit("brush.size big");

    assert.equal(brush.size, 1);
    assert.deepEqual(lines(commands), [
      "echo: brush.size big",
      "error: Expected a number, got \"big\""
    ]);
  });

  test("a setter returning false or throwing becomes an error entry", async() => {
    const commands = new CommandConsole();
    commands.registerVariable("name", {
      type: "string",
      description: "",
      get: () => "a",
      set: (value) => {
        if (value === "taken") {
          throw new Error("\"taken\" is already bound to undo");
        }

        return false;
      }
    });

    await commands.submit("name other");
    await commands.submit("name taken");

    assert.deepEqual(lines(commands), [
      "echo: name other",
      "error: name rejected \"other\"",
      "echo: name taken",
      "error: \"taken\" is already bound to undo"
    ]);
  });

  test("an async setter keeps the echo pending and reads back once it settles", async() => {
    let name = "a";
    const write = Promise.withResolvers<false | undefined>();
    const commands = new CommandConsole();
    commands.registerVariable("name", {
      type: "string",
      description: "",
      get: () => name,
      set: (value) => write.promise.then((result) => {
        name = value;

        return result;
      })
    });

    const submitted = commands.submit("name b");
    await Promise.resolve();
    assert.equal(commands.scrollback[0].pending, true);
    write.resolve(undefined);
    await submitted;

    assert.equal(commands.scrollback[0].pending, false);
    assert.deepEqual(lines(commands), ["echo: name b", "info: b"]);
  });

  test("a value with spaces must be quoted", async() => {
    const values: string[] = [];
    const commands = new CommandConsole();
    commands.registerVariable("redo", {
      type: "string",
      description: "",
      get: () => values.at(-1) ?? "",
      set: (value) => {
        values.push(value);
      }
    });

    await commands.submit("redo mod+y, mod+shift+z");
    await commands.submit("redo \"mod+y, mod+shift+z\"");

    assert.deepEqual(values, ["mod+y, mod+shift+z"]);
    assert.equal(commands.scrollback[1].kind, "error");
  });

  test("an enum write is passed in its declared case", async() => {
    let mode = "add";
    const commands = new CommandConsole();
    commands.registerVariable("mode", {
      type: "enum",
      description: "",
      enumValues: ["add", "rotateY"],
      get: () => mode,
      set: (value) => {
        mode = value;
      }
    });

    await commands.submit("mode ROTATEY");

    assert.equal(mode, "rotateY");
  });
});

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

  test("an unknown word in search mode is an error, not a search", async() => {
    const commands = new CommandConsole();

    await commands.submit("nothing");

    assert.equal(commands.scrollback[1].kind, "error");
  });

  test("an unknown command suggests the closest one without running it", async() => {
    let called = false;
    const commands = new CommandConsole();
    commands.registerNamespace("brush").registerCommand("grow", {
      description: "",
      args: [],
      execute: () => {
        called = true;
      }
    });

    await commands.submit("/brush.grwo");

    assert.equal(called, false);
    assert.equal(
      lines(commands).at(-1),
      "error: Unknown command \"/brush.grwo\". Did you mean /brush.grow?"
    );
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

describe("built-ins", () => {
  test("/clear empties the scrollback", async() => {
    const { commands } = withBrush();
    await commands.submit("brush.size");

    await commands.submit("/clear");

    assert.deepEqual(commands.scrollback, []);
  });

  test("/help prints a signature generated from the arguments", async() => {
    const commands = new CommandConsole();
    commands.registerNamespace("chat", { description: "Chat" }).registerCommand("say", {
      description: "Say something",
      args: [
        { name: "to", type: "string", required: true },
        { name: "tone", type: "enum", enumValues: ["loud", "soft"] },
        { name: "text", type: "string", rest: true }
      ],
      execute: () => undefined
    });

    await commands.submit("/help chat.say");
    await commands.submit("/help chat");

    assert.deepEqual(lines(commands), [
      "echo: /help chat.say",
      "info: /chat.say <to> [tone:loud|soft] [text...]  Say something",
      "echo: /help chat",
      "info: chat: Chat\nCommands\n  /chat.say <to> [tone:loud|soft] [text...]  Say something"
    ]);
  });

  test("/help with no name lists namespaces and root entries", async() => {
    const { commands } = withBrush();

    await commands.submit("/help");

    assert.equal(commands.scrollback[1].text, [
      "Namespaces",
      "  brush",
      "Commands",
      "  /clear        Clear the scrollback",
      "  /help [name]  List namespaces and commands, or describe one"
    ].join("\n"));
  });

  test("/help reports a name that resolves to nothing", async() => {
    const commands = new CommandConsole();

    await commands.submit("/help nope");

    assert.deepEqual(lines(commands).at(-1), "error: Nothing is registered as \"nope\"");
  });

  test("built-ins can be overwritten", async() => {
    const commands = new CommandConsole();
    commands.registerCommand("clear", {
      description: "",
      args: [],
      execute: (_args, ctx) => ctx.print("custom")
    });

    await commands.submit("/clear");

    assert.deepEqual(lines(commands), ["echo: /clear", "info: custom"]);
  });
});

describe("events", () => {
  test("open and close emit their requests", () => {
    const events: string[] = [];
    const commands = new CommandConsole();
    commands.on("open-requested", () => events.push("open"));
    commands.on("close-requested", () => events.push("close"));

    commands.open();
    commands.close();

    assert.deepEqual(events, ["open", "close"]);
  });

  test("registration and output fire separate change events", async() => {
    const events: string[] = [];
    const commands = new CommandConsole();
    commands.on("registry-changed", () => events.push("registry"));
    commands.on("scrollback-changed", () => events.push("scrollback"));

    commands.registerNamespace("a");
    await commands.submit("/help");

    assert.deepEqual(events, ["registry", "scrollback", "scrollback"]);
  });
});
