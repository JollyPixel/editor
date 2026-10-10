// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";

// Import Internal Dependencies
import {
  runtimeConsole,
  type RuntimeConsoleContext
} from "#src/console/namespaces/runtime.ts";

interface Widget {
  hidden: boolean;
}

interface FakeRuntime {
  statsHud: Widget | null;
  viewHelper: Widget | null;
  metrics: {
    panel: Widget | null;
  };
}

function createRuntime(
  overrides: Partial<FakeRuntime> = {}
): FakeRuntime {
  return {
    statsHud: {
      hidden: false
    },
    viewHelper: {
      hidden: false
    },
    metrics: {
      panel: {
        hidden: true
      }
    },
    ...overrides
  };
}

function registerRuntime(
  runtime: RuntimeConsoleContext["runtime"]
): CommandConsole {
  const commands = new CommandConsole();
  runtimeConsole(commands, { runtime });

  return commands;
}

function lastLine(
  commands: CommandConsole
): string {
  const entry = commands.scrollback.at(-1);

  return `${entry?.kind}: ${entry?.text}`;
}

describe("runtime console", () => {
  test("stats and viewHelper hide their corner widgets", async() => {
    const runtime = createRuntime();
    const commands = registerRuntime(runtime);

    await commands.submit("runtime.stats off");
    await commands.submit("runtime.viewHelper off");

    assert.equal(runtime.statsHud?.hidden, true);
    assert.equal(runtime.viewHelper?.hidden, true);
  });

  test("stats and viewHelper are absent without their widget", async() => {
    const commands = registerRuntime(createRuntime({
      statsHud: null,
      viewHelper: null
    }));

    await commands.submit("runtime.stats off");
    assert.match(lastLine(commands), /^error: "runtime\.stats off" is not a variable/);

    await commands.submit("runtime.viewHelper off");
    assert.match(lastLine(commands), /^error: "runtime\.viewHelper off" is not a variable/);
  });

  test("metrics shows and hides the mounted performance pane", async() => {
    const runtime = createRuntime();
    const commands = registerRuntime(runtime);

    await commands.submit("runtime.metrics on");
    assert.equal(runtime.metrics.panel?.hidden, false);
    assert.equal(lastLine(commands), "info: true");

    await commands.submit("runtime.metrics off");
    assert.equal(runtime.metrics.panel?.hidden, true);
  });

  test("metrics reports an error until a performance pane is mounted", async() => {
    const runtime = createRuntime({
      metrics: {
        panel: null
      }
    });
    const commands = registerRuntime(runtime);

    await commands.submit("runtime.metrics on");

    assert.match(lastLine(commands), /^error: .*No performance pane is mounted/);
  });
});
