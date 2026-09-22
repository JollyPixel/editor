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
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE,
  type ShellCommand
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  EditorTabs,
  type EditorTab,
  type EditorTabsOptions
} from "../src/tabs/EditorTabs.ts";

// CONSTANTS
const kOrigin = "http://localhost";
const kMap: EditorTab = {
  id: "map-1",
  label: "overworld.voxelmap.json",
  url: "/editors/voxel-map/?target=map-1"
};
const kModel: EditorTab = {
  id: "model-1",
  label: "model.voxelmodel.json",
  url: "/editors/voxel-model/?target=model-1"
};
const kOther: EditorTab = {
  id: "map-2",
  label: "cave.voxelmap.json",
  url: "/editors/voxel-map/?target=map-2"
};

interface Harness {
  tabs: EditorTabs;
  strip: HTMLElement & { value: string; };
  frames: HTMLElement;
  itemValues(): string[];
  frameOf(id: string): HTMLIFrameElement;
  visibleFrames(): string[];
}

let current: Harness | undefined;

function harness(
  options: Partial<EditorTabsOptions> = {}
): Harness {
  const strip = Object.assign(document.createElement("jolly-tabs"), {
    value: ""
  });
  const frames = document.createElement("div");
  document.body.append(strip, frames);
  const tabs = new EditorTabs({
    strip,
    frames,
    launchOrigin: kOrigin,
    ...options
  });
  function frameList(): HTMLIFrameElement[] {
    return [...frames.querySelectorAll("iframe")];
  }

  current = {
    tabs,
    strip,
    frames,
    itemValues: () => [...strip.children].map(
      (item) => String(Reflect.get(item, "value"))
    ),
    frameOf: (id) => {
      const frame = frameList().find(
        (candidate) => candidate.src.endsWith(`target=${id}`)
      );
      assert.ok(frame, `frame for ${id}`);

      return frame;
    },
    visibleFrames: () => frameList()
      .filter((frame) => !frame.hidden)
      .map((frame) => frame.src)
  };

  return current;
}

function postFromFrame(
  frame: HTMLIFrameElement,
  data: unknown
): void {
  window.dispatchEvent(new MessageEvent("message", {
    source: frame.contentWindow,
    origin: kOrigin,
    data
  }));
}

afterEach(() => {
  current?.tabs.dispose();
  current = undefined;
  document.body.replaceChildren();
});

describe("EditorTabs", () => {
  test("opens a tab with its frame and activates it", async() => {
    const { tabs, strip, itemValues, frameOf, visibleFrames } = harness();

    assert.equal(await tabs.open(kMap), true);

    assert.deepEqual(itemValues(), ["map-1"]);
    assert.equal(strip.value, "map-1");
    assert.equal(tabs.active, "map-1");
    assert.ok(frameOf("map-1").src.endsWith(kMap.url));
    assert.equal(frameOf("map-1").title, kMap.label);
    assert.equal(visibleFrames().length, 1);
  });

  test("focuses an already open tab instead of duplicating it", async() => {
    const { tabs, itemValues, frameOf } = harness();
    await tabs.open(kMap);
    await tabs.open(kModel);

    assert.equal(tabs.active, "model-1");
    assert.equal(frameOf("map-1").hidden, true);

    assert.equal(await tabs.open(kMap), true);

    assert.deepEqual(itemValues(), ["map-1", "model-1"]);
    assert.equal(tabs.active, "map-1");
    assert.equal(frameOf("map-1").hidden, false);
    assert.equal(frameOf("model-1").hidden, true);
  });

  test("closes a tab and focuses the most recently activated one", async() => {
    const { tabs, itemValues, frames } = harness();
    await tabs.open(kMap);
    await tabs.open(kModel);
    await tabs.open(kOther);
    tabs.focus("model-1");

    assert.equal(tabs.close("model-1"), true);

    assert.deepEqual(itemValues(), ["map-1", "map-2"]);
    assert.equal(frames.querySelectorAll("iframe").length, 2);
    assert.equal(tabs.active, "map-2");
    assert.equal(tabs.close("model-1"), false);
  });

  test("closing an inactive tab keeps the active one", async() => {
    const { tabs, strip } = harness();
    await tabs.open(kMap);
    await tabs.open(kModel);

    tabs.close("map-1");

    assert.equal(tabs.active, "model-1");
    assert.equal(strip.value, "model-1");
  });

  test("clears the strip when the last tab closes", async() => {
    const { tabs, strip } = harness();
    await tabs.open(kMap);

    tabs.close("map-1");

    assert.equal(tabs.active, null);
    assert.equal(strip.value, "");
    assert.equal(tabs.size, 0);
  });

  test("evicts the least recently activated tab at the cap", async() => {
    const asked: string[] = [];
    const { tabs, itemValues } = harness({
      cap: 2,
      confirmEvict: (tab) => {
        asked.push(tab.id);

        return true;
      }
    });
    await tabs.open(kMap);
    await tabs.open(kModel);
    tabs.focus("map-1");

    assert.equal(await tabs.open(kOther), true);

    assert.deepEqual(asked, ["model-1"]);
    assert.deepEqual(itemValues(), ["map-1", "map-2"]);
    assert.equal(tabs.active, "map-2");
  });

  test("leaves the request unopened when eviction is declined", async() => {
    const { tabs, itemValues } = harness({
      cap: 2,
      confirmEvict: () => Promise.resolve(false)
    });
    await tabs.open(kMap);
    await tabs.open(kModel);

    assert.equal(await tabs.open(kOther), false);

    assert.deepEqual(itemValues(), ["map-1", "model-1"]);
    assert.equal(tabs.active, "model-1");
  });

  test("follows the strip's change and close events", async() => {
    const { tabs, strip } = harness();
    await tabs.open(kMap);
    await tabs.open(kModel);

    strip.dispatchEvent(new CustomEvent("jolly-tab-change", {
      detail: { value: "map-1" }
    }));
    assert.equal(tabs.active, "map-1");

    strip.dispatchEvent(new CustomEvent("jolly-tab-close", {
      detail: { value: "map-1" }
    }));
    assert.deepEqual(tabs.ids(), ["model-1"]);
  });

  test("answers a frame's ready message with its launch", async() => {
    const { tabs, frameOf } = harness();
    await tabs.open(kMap);
    const frame = frameOf("map-1");
    const posted: Array<[unknown, string]> = [];
    assert.ok(frame.contentWindow);
    Object.assign(frame.contentWindow, {
      postMessage: (message: unknown, origin: string) => {
        posted.push([message, origin]);
      }
    });

    window.dispatchEvent(new MessageEvent("message", {
      source: window,
      data: { type: READY_MESSAGE_TYPE }
    }));
    postFromFrame(frame, { type: READY_MESSAGE_TYPE });

    assert.deepEqual(posted, [
      [
        {
          type: LAUNCH_MESSAGE_TYPE,
          target: "map-1"
        },
        kOrigin
      ]
    ]);
  });

  test("routes a frame's shell command with its tab", async() => {
    const received: Array<[ShellCommand, string]> = [];
    const { tabs, frameOf } = harness({
      onShellCommand: (command, from) => {
        received.push([command, from.id]);
      }
    });
    await tabs.open(kMap);

    postFromFrame(frameOf("map-1"), {
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: "tileset-1"
    });
    postFromFrame(frameOf("map-1"), {
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

  test("relabels an open tab", async() => {
    const { tabs, strip, frameOf } = harness();
    await tabs.open(kMap);

    assert.equal(tabs.relabel("map-1", "renamed.voxelmap.json"), true);
    assert.equal(tabs.relabel("missing", "x"), false);

    assert.equal(Reflect.get(strip.children[0], "label"), "renamed.voxelmap.json");
    assert.equal(frameOf("map-1").title, "renamed.voxelmap.json");
  });

  test("dispose removes every tab and stops listening", async() => {
    const { tabs, strip, frames } = harness();
    await tabs.open(kMap);
    await tabs.open(kModel);

    tabs.dispose();
    strip.dispatchEvent(new CustomEvent("jolly-tab-change", {
      detail: { value: "map-1" }
    }));

    assert.equal(tabs.size, 0);
    assert.equal(strip.children.length, 0);
    assert.equal(frames.children.length, 0);
    assert.equal(tabs.active, null);
  });
});
