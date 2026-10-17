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
      "  /cd [namespace]         Enter a namespace; .. goes up, no name returns to the root",
      "  /clear                  Clear the scrollback",
      "  /help [name]            List namespaces and commands, or describe one",
      "  /revert [count:number]  Undo the last changes made from the console",
      "  /script [namespace]     Edit variables together as a script, then save or cancel"
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
