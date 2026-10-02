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
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE,
  type ShellCommand
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  EditorFrames,
  type EditorFramesOptions
} from "../src/tabs/EditorFrames.ts";
import type { EditorTab } from "../src/tabs/EditorTabs.ts";

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

    assert.deepEqual(posted, [
      [
        {
          type: LAUNCH_MESSAGE_TYPE,
          target: "map-1",
          appearance: { theme: "dark", density: "comfortable" }
        },
        kOrigin
      ]
    ]);
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
      target: "tileset-1"
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
          target: "tileset-1"
        },
        "map-1"
      ]
    ]);
  });

  test("dispose removes the frames and stops answering", async() => {
    const element = scope();
    const frames = editorFrames();
    frames.show(kMap);
    const loaded = frame();
    const posted = recordPosts(loaded);

    frames.dispose();
    postFrom(loaded.contentWindow, { type: READY_MESSAGE_TYPE });
    element.setAttribute("theme", "light");
    await setImmediate();

    assert.equal(document.querySelector("iframe"), null);
    assert.deepEqual(posted, []);
  });
});
