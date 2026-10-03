// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  CommandConsole,
  ConsoleServer
} from "@jolly-pixel/console";

// Import Internal Dependencies
import { FrameConsoles } from "#src/console/FrameConsoles.ts";
import { captureLogs } from "../helpers/logs.ts";

const closers: Array<() => void> = [];

afterEach(() => {
  for (const close of closers.splice(0)) {
    close();
  }
});

function editorPort(
  namespace: string
): MessagePort {
  const commands = new CommandConsole();
  commands.registerNamespace(namespace);
  const channel = new MessageChannel();
  const server = new ConsoleServer(commands, channel.port1);
  closers.push(() => server.close());

  return channel.port2;
}

function namespaces(
  commands: CommandConsole
): string[] {
  return [...commands.registry.namespaces()].map(
    (namespace) => namespace.name
  );
}

async function settled(
  commands: CommandConsole,
  expected: string[]
): Promise<string[]> {
  for (
    let attempt = 0;
    attempt < 100 && namespaces(commands).join() !== expected.join();
    attempt++
  ) {
    await setImmediate();
  }

  return namespaces(commands);
}

describe("FrameConsoles", () => {
  test("shows the namespaces of the focused frame only", async() => {
    const commands = new CommandConsole();
    const frames = new FrameConsoles({ commands });
    closers.push(
      frames.connect("map", editorPort("brush")),
      frames.connect("sprite", editorPort("keybind"))
    );

    frames.focus("map");
    assert.deepEqual(await settled(commands, ["brush"]), ["brush"]);
    frames.focus("sprite");
    assert.deepEqual(await settled(commands, ["keybind"]), ["keybind"]);
    frames.focus(null);
    assert.deepEqual(await settled(commands, []), []);
  });

  test("attaches a focused frame once its launch connects", async() => {
    const commands = new CommandConsole();
    const frames = new FrameConsoles({ commands });

    frames.focus("map");
    const disconnect = frames.connect("map", editorPort("brush"));
    assert.deepEqual(await settled(commands, ["brush"]), ["brush"]);
    disconnect();

    assert.deepEqual(namespaces(commands), []);
  });

  test("a reconnected frame replaces the namespaces of its previous page", async() => {
    const commands = new CommandConsole();
    const frames = new FrameConsoles({ commands });
    frames.focus("map");
    const first = frames.connect("map", editorPort("brush"));
    await settled(commands, ["brush"]);

    closers.push(frames.connect("map", editorPort("layers")));
    first();

    assert.deepEqual(await settled(commands, ["layers"]), ["layers"]);
  });

  test("warns when a frame namespace is hidden by the shell", async() => {
    const commands = new CommandConsole();
    commands.registerNamespace("brush");
    const { logger, lines, metas } = captureLogs();
    const frames = new FrameConsoles({
      commands,
      logger
    });
    frames.focus("map");
    closers.push(frames.connect("map", editorPort("brush")));

    for (let attempt = 0; attempt < 100 && lines.length === 0; attempt++) {
      await setImmediate();
    }

    assert.equal(lines.length, 1);
    assert.match(lines[0], /editor namespace hidden by the shell/);
    assert.deepEqual(metas, [
      {
        frame: "map",
        namespace: "brush"
      }
    ]);
  });
});
