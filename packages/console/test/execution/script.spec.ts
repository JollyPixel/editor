// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  CommandConsole,
  VariableScript
} from "#src/index.ts";
import { withBrush } from "../helpers/script/withBrush.ts";

function lines(
  commands: CommandConsole,
  from = 0
): string[] {
  return commands.scrollback
    .slice(from)
    .map((entry) => `${entry.kind}: ${entry.text}`);
}

function edit(
  script: VariableScript,
  replacements: Record<string, string>
): string {
  let text = script.text;
  for (const [from, to] of Object.entries(replacements)) {
    assert.ok(text.includes(from), from);
    text = text.replace(from, to);
  }

  return text;
}

describe("/script", () => {
  test("requests a script over every variable, or one namespace's", async() => {
    const { commands } = withBrush();
    const requested: Array<string | null> = [];
    commands.on("script-requested", (script) => requested.push(script.scope));

    await commands.submit("/script");
    await commands.submit("/script Brush");

    assert.deepEqual(requested, [null, "brush"]);
    assert.deepEqual(lines(commands), ["echo: /script", "echo: /script Brush"]);
  });

  test("reports a namespace that is unknown or holds no variables", async() => {
    const { commands } = withBrush();
    const requested: VariableScript[] = [];
    commands.on("script-requested", (script) => requested.push(script));

    await commands.submit("/script nope");
    await commands.submit("/script audio");

    assert.deepEqual(requested, []);
    assert.deepEqual(lines(commands), [
      "echo: /script nope",
      "error: Unknown namespace \"nope\"",
      "echo: /script audio",
      "error: audio has no variables"
    ]);
  });

  test("completes the namespaces that hold variables", async() => {
    const { commands } = withBrush();
    const [arg] = commands.registry.resolveCommand("script")?.def.args ?? [];

    assert.deepEqual(await arg?.autocomplete?.(), ["brush"]);
  });
});

describe("applyScript", () => {
  test("writes edited variables in document order and echoes each as a prompt line", async() => {
    const { commands, brush, writes } = withBrush();
    const script = commands.editScript();
    const draft = script.parse(edit(script, {
      "label = main brush": "label = \"big one\"",
      "size = 1": "size = 4",
      "theme = dark": "theme = light"
    }));

    const result = await commands.applyScript(draft);

    assert.deepEqual(result, {
      ok: true,
      applied: 3
    });
    assert.deepEqual(writes, ["theme=light", "size=4", "label=big one"]);
    assert.equal(brush.label, "big one");
    assert.deepEqual(lines(commands), [
      "echo: theme light",
      "echo: brush.size 4",
      "echo: brush.label \"big one\""
    ]);
  });

  test("an unedited script writes nothing and leaves nothing to revert", async() => {
    const { commands, writes } = withBrush();
    const script = commands.editScript();

    const result = await commands.applyScript(script.parse(script.text));
    await commands.submit("/revert");

    assert.deepEqual(result, {
      ok: true,
      applied: 0
    });
    assert.deepEqual(writes, []);
    assert.deepEqual(lines(commands), ["echo: /revert", "info: Nothing to revert"]);
  });

  test("a rejected value restores the variables already written and keeps nothing to revert", async() => {
    const { commands, brush, writes } = withBrush();
    const script = commands.editScript();
    const draft = script.parse([
      "theme = light",
      "[brush]",
      "mode = replace",
      "label = renamed",
      "size = 40"
    ].join("\n"));

    const result = await commands.applyScript(draft);
    await commands.submit("/revert");

    const error = "Script not applied: brush.size rejected \"40\"";
    assert.deepEqual(result, {
      ok: false,
      error
    });
    assert.deepEqual(writes, [
      "theme=light",
      "mode=replace",
      "label=renamed",
      "label=main brush",
      "mode=build",
      "theme=dark"
    ]);
    assert.deepEqual(lines(commands), [
      `error: ${error}`,
      "echo: /revert",
      "info: Nothing to revert"
    ]);
    assert.deepEqual(brush, {
      theme: "dark",
      size: 1,
      mode: "build",
      ghost: true,
      label: "main brush"
    });
  });

  test("a rollback names the variables it could not restore", async() => {
    const { commands } = withBrush();
    let mode = "build";
    let accepts = true;
    commands.registerNamespace("pen").registerVariable("mode", {
      type: "string",
      description: "",
      get: () => mode,
      set: (value) => {
        if (!accepts) {
          return false;
        }
        mode = value;
        accepts = false;

        return undefined;
      }
    });
    const script = commands.editScript("pen");
    const draft = script.parse("[pen]\nmode = erase\n[brush]\nsize = 99");

    const result = await commands.applyScript(draft);

    assert.deepEqual(result, {
      ok: false,
      error: "Script not applied: brush.size rejected \"99\"; could not restore pen.mode"
    });
    assert.equal(mode, "erase");
  });

  test("a draft with diagnostics is refused before any write", async() => {
    const { commands, writes } = withBrush();
    const script = commands.editScript();

    const result = await commands.applyScript(script.parse("theme = light\nsize"));

    assert.deepEqual(result, {
      ok: false,
      error: "The script has 1 error"
    });
    assert.deepEqual(writes, []);
    assert.deepEqual(lines(commands), []);
  });

  test("/revert restores a whole save in one step, skipping variables unregistered since", async() => {
    const { commands, brush } = withBrush();
    let width = 1;
    const pen = commands.registerNamespace("pen");
    pen.registerVariable("width", {
      type: "number",
      description: "",
      get: () => width,
      set: (value) => {
        width = value;
      }
    });
    const script = commands.editScript();
    await commands.applyScript(script.parse(edit(script, {
      "size = 1": "size = 5",
      "mode = build": "mode = replace",
      "width = 1": "width = 3"
    })));
    pen.unregister();

    const from = commands.scrollback.length;
    await commands.submit("/revert");

    assert.deepEqual(lines(commands, from), [
      "echo: /revert",
      "info: Reverted script (brush.size 5, brush.mode replace, pen.width 3)"
    ]);
    assert.equal(brush.size, 1);
    assert.equal(brush.mode, "build");
    assert.equal(width, 3);
  });

  test("/revert skips a save whose variables are all unregistered", async() => {
    const { commands } = withBrush();
    let width = 1;
    const pen = commands.registerNamespace("pen");
    pen.registerVariable("width", {
      type: "number",
      description: "",
      get: () => width,
      set: (value) => {
        width = value;
      }
    });
    const script = commands.editScript("pen");
    await commands.applyScript(script.parse("[pen]\nwidth = 3"));
    pen.unregister();

    const from = commands.scrollback.length;
    await commands.submit("/revert");

    assert.deepEqual(lines(commands, from), [
      "echo: /revert",
      "error: Skipped script (pen.width 3): its variables are no longer registered",
      "info: Nothing to revert"
    ]);
  });
});
