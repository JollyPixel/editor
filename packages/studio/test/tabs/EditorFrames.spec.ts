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
  APPEARANCE_MESSAGE_TYPE,
  LAUNCH_MESSAGE_TYPE,
  parseLaunchMessage,
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE,
  type ShellCommand
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  EditorFrames,
  type EditorFramesOptions
} from "../../src/tabs/EditorFrames.ts";
import type { EditorTab } from "../../src/tabs/EditorTabs.ts";
import { idleShare } from "../helpers/catalogShare.ts";

// CONSTANTS
const kOrigin = "http://localhost";
const kMap: EditorTab = {
  id: "map-1",
  label: "overworld.voxelmap.json",
  url: "/editors/voxel-map/?target=map-1"
};

let current: EditorFrames | undefined;

function editorFrames(
  options: Partial<EditorFramesOptions> = {}
): EditorFrames {
  const container = document.createElement("div");
  document.body.append(container);
  current = new EditorFrames({
    container,
    launchOrigin: kOrigin,
    share: idleShare(),
    ...options
  });

  return current;
}

function scope(): HTMLElement {
  const element = document.createElement("jolly-scope");
  element.setAttribute("theme", "dark");
  element.setAttribute("density", "comfortable");
  document.body.append(element);

  return element;
}

function frame(): HTMLIFrameElement {
  const element = document.querySelector("iframe");
  assert.ok(element);

  return element;
}

function recordPosts(
  target: HTMLIFrameElement
): Array<[unknown, string]> {
  const posted: Array<[unknown, string]> = [];
  assert.ok(target.contentWindow);
  Object.assign(target.contentWindow, {
    postMessage: (message: unknown, origin: string) => {
      posted.push([message, origin]);
    }
  });

  return posted;
}

function postFrom(
  source: MessageEventSource | null,
  data: unknown
): void {
  window.dispatchEvent(new MessageEvent("message", {
    source,
    origin: kOrigin,
    data
  }));
}

afterEach(() => {
  current?.dispose();
  current = undefined;
  document.body.replaceChildren();
});

describe("EditorFrames", () => {
  test("answers its own frame's ready message with the launch and the page appearance", () => {
    scope();
    editorFrames().show(kMap);
    const posted = recordPosts(frame());

    postFrom(window, { type: READY_MESSAGE_TYPE });
    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });

    assert.deepEqual(
      posted.map(([message, origin]) => {
        const { ports, ...launch } = parseLaunchMessage(message)!;

        return [launch, Object.keys(ports), origin];
      }),
      [
        [
          {
            type: LAUNCH_MESSAGE_TYPE,
            target: "map-1",
            appearance: { theme: "dark", density: "comfortable" },
            identity: null
          },
          ["catalog"],
          kOrigin
        ]
      ]
    );
  });

  test("launches every frame as the shell's peer", () => {
    const frames = editorFrames({
      identity: {
        username: "alice",
        peerId: "peer-alice"
      }
    });
    frames.show(kMap);
    const posted = recordPosts(frame());

    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });

    assert.deepEqual(
      posted.map(([message]) => parseLaunchMessage(message)?.identity),
      [{ username: "alice", peerId: "peer-alice" }]
    );
  });

  test("sends a catalog port with each launch and stops the previous one", () => {
    const served: MessagePort[] = [];
    const stopped: MessagePort[] = [];
    const frames = editorFrames({
      share: {
        serve: (connector) => {
          served.push(connector);

          return () => stopped.push(connector);
        }
      }
    });
    frames.show(kMap);
    const transferred: unknown[] = [];
    Object.assign(frame().contentWindow!, {
      postMessage: (_message: unknown, _origin: string, transfer: unknown[]) => {
        transferred.push(...transfer);
      }
    });

    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    assert.strictEqual(served.length, 2);
    assert.strictEqual(transferred.length, 2);
    assert.deepEqual(stopped, [served[0]]);

    frames.remove(kMap.id);
    assert.deepEqual(stopped, served);
  });

  test("connects a console port with each launch and focuses the shown frame", () => {
    const calls: string[] = [];
    const frames = editorFrames({
      consoles: {
        connect: (id) => {
          calls.push(`connect ${id}`);

          return () => calls.push(`disconnect ${id}`);
        },
        focus: (id) => calls.push(`focus ${id}`)
      }
    });
    frames.show(kMap);
    const launches: Array<[unknown, unknown[]]> = [];
    Object.assign(frame().contentWindow!, {
      postMessage: (message: unknown, _origin: string, transfer: unknown[]) => {
        launches.push([message, transfer]);
      }
    });

    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    frames.show(null);
    frames.remove(kMap.id);

    assert.deepEqual(calls, [
      "focus map-1",
      "connect map-1",
      "disconnect map-1",
      "connect map-1",
      "focus null",
      "disconnect map-1"
    ]);
    for (const [message, transferred] of launches) {
      const ports = parseLaunchMessage(message)?.ports;
      assert.ok(ports?.catalog instanceof MessagePort);
      assert.ok(ports.console instanceof MessagePort);
      assert.deepEqual(transferred, [ports.catalog, ports.console]);
    }
    assert.strictEqual(launches.length, 2);
  });

  test("posts the page appearance to loaded frames when it changes", async() => {
    const element = scope();
    editorFrames().show(kMap);
    const posted = recordPosts(frame());

    element.setAttribute("theme", "light");
    await setImmediate();

    assert.deepEqual(posted, [
      [
        {
          type: APPEARANCE_MESSAGE_TYPE,
          appearance: { theme: "light", density: "comfortable" }
        },
        kOrigin
      ]
    ]);
  });

  test("lets an editor frame read the keyboard layout", () => {
    editorFrames().show(kMap);

    assert.equal(frame().allow, "keyboard-map");
  });

  test("routes a frame's shell command with its tab id", () => {
    const received: Array<[ShellCommand, string]> = [];
    editorFrames({
      onShellCommand: (command, from) => {
        received.push([command, from]);
      }
    }).show(kMap);

    postFrom(frame().contentWindow, {
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: "blockset-1"
    });
    postFrom(frame().contentWindow, {
      type: SHELL_MESSAGE_TYPE,
      command: "unknown"
    });

    assert.deepEqual(received, [
      [
        {
          type: SHELL_MESSAGE_TYPE,
          command: "open-asset",
          target: "blockset-1"
        },
        "map-1"
      ]
    ]);
  });

  test("dispose removes the frames", () => {
    const frames = editorFrames();
    frames.show(kMap);

    frames.dispose();

    assert.equal(document.querySelector("iframe"), null);
  });
});
