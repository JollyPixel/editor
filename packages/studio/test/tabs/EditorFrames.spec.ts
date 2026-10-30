// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  LAUNCH_MESSAGE_TYPE,
  parseLaunchMessage,
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE,
  preferencesMessage,
  revealMessage,
  type LaunchIdentity,
  type ShellCommand
} from "@jolly-pixel/editor.host";
import {
  Preferences,
  RUNTIME_PREFERENCES
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import {
  disposeFrames,
  editorFrames,
  frame,
  FRAME_ORIGIN,
  postFrom,
  recordPosts,
  scope
} from "../helpers/editorFrames.ts";
import { MAP_TAB } from "../helpers/editorTabs.ts";

afterEach(disposeFrames);

describe("EditorFrames", () => {
  test("answers its own frame's ready message with the launch and the page appearance", () => {
    scope();
    editorFrames().show(MAP_TAB);
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
            identity: null,
            preferences: {}
          },
          ["catalog"],
          FRAME_ORIGIN
        ]
      ]
    );
  });

  test("launches with the shell's preferences, then pushes each change", () => {
    const preferences = new Preferences({
      overrides: [["runtime", { stats: false }]]
    });
    editorFrames({ preferences }).show(MAP_TAB);
    const posted = recordPosts(frame());

    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    preferences.assign(RUNTIME_PREFERENCES, "metrics", true);

    assert.deepEqual(
      parseLaunchMessage(posted[0]?.[0])?.preferences,
      { runtime: { stats: false } }
    );
    assert.deepEqual(posted[1], [
      preferencesMessage("runtime", { stats: false, metrics: true }),
      FRAME_ORIGIN
    ]);
  });

  test("launches every frame as the shell's current peer", () => {
    const alice: LaunchIdentity = {
      username: "alice",
      peerId: "peer-alice"
    };
    let identity = alice;
    editorFrames({ identity: () => identity }).show(MAP_TAB);
    const posted = recordPosts(frame());

    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    identity = {
      ...alice,
      avatar: "/api/accounts/peer-alice/avatar?v=2"
    };
    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });

    assert.deepEqual(
      posted.map(([message]) => parseLaunchMessage(message)?.identity),
      [
        alice,
        {
          ...alice,
          avatar: "/api/accounts/peer-alice/avatar?v=2"
        }
      ]
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
    frames.show(MAP_TAB);
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

    frames.remove(MAP_TAB.id);
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
    frames.show(MAP_TAB);
    const launches: Array<[unknown, unknown[]]> = [];
    Object.assign(frame().contentWindow!, {
      postMessage: (message: unknown, _origin: string, transfer: unknown[]) => {
        launches.push([message, transfer]);
      }
    });

    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    frames.show(null);
    frames.remove(MAP_TAB.id);

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

  test("lets an editor frame read the keyboard layout", () => {
    editorFrames().show(MAP_TAB);

    assert.equal(frame().allow, "keyboard-map");
  });

  test("routes a frame's shell command with its tab id", () => {
    const received: Array<[ShellCommand, string]> = [];
    editorFrames({
      onShellCommand: (command, from) => {
        received.push([command, from]);
      }
    }).show(MAP_TAB);

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

  test("posts a reveal right after the frame's launch, then later reveals right away", () => {
    scope();
    const frames = editorFrames();
    frames.show(MAP_TAB);
    const posted = recordPosts(frame());

    frames.reveal("map-1", "object:early");
    assert.equal(posted.length, 0);
    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });
    frames.reveal("map-1", "object:later");
    postFrom(frame().contentWindow, { type: READY_MESSAGE_TYPE });

    const messages = posted.map(([message]) => message);
    assert.equal(messages.length, 4);
    const [launch, early, later, relaunch] = messages;
    assert.notEqual(parseLaunchMessage(launch), undefined);
    assert.deepEqual(early, revealMessage("object:early"));
    assert.deepEqual(later, revealMessage("object:later"));
    assert.notEqual(parseLaunchMessage(relaunch), undefined);
  });

  test("dispose removes the frames", () => {
    const frames = editorFrames();
    frames.show(MAP_TAB);

    frames.dispose();

    assert.equal(document.querySelector("iframe"), null);
  });
});
