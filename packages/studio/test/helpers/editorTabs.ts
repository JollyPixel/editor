// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { EditorFrames } from "../../src/tabs/EditorFrames.ts";
import { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import { idleShare } from "./catalogShare.ts";
import {
  EditorTabs,
  type EditorTab,
  type EditorTabsOptions
} from "../../src/tabs/EditorTabs.ts";

// CONSTANTS
export const MAP_TAB: EditorTab = {
  id: "map-1",
  editor: "voxel-map",
  label: "overworld.voxelmap.json",
  url: "/editors/voxel-map/?target=map-1"
};
export const MODEL_TAB: EditorTab = {
  id: "model-1",
  editor: "voxel-model",
  label: "model.voxelmodel.json",
  url: "/editors/voxel-model/?target=model-1"
};
export const PAGE_ID = "settings";
export const OTHER_TAB: EditorTab = {
  id: "map-2",
  editor: "voxel-map",
  label: "cave.voxelmap.json",
  url: "/editors/voxel-map/?target=map-2"
};

interface Harness {
  tabs: EditorTabs;
  editorFrames: EditorFrames;
  strip: HTMLElement & { value: string; };
  frames: HTMLElement;
  home: HTMLElement;
  page: HTMLElement;
  itemValues(): string[];
  tabStatus(id: string): string;
  findFrame(id: string): HTMLIFrameElement;
  visibleFrames(): string[];
}

let current: Harness | undefined;

export function harness(
  options: Partial<EditorTabsOptions> = {}
): Harness {
  const strip = Object.assign(document.createElement("jolly-tabs"), {
    value: ""
  });
  const frames = document.createElement("div");
  const home = document.createElement("section");
  const page = document.createElement("section");
  document.body.append(strip, frames, home, page);
  const editorFrames = new EditorFrames({
    container: frames,
    share: idleShare(),
    preferences: new Preferences(),
    scopes: new PreferenceScopes([], [])
  });
  const tabs = new EditorTabs({
    strip,
    frames: editorFrames,
    home,
    pages: [
      {
        id: PAGE_ID,
        label: "Settings",
        icon: "settings",
        element: page
      }
    ],
    ...options
  });
  function frameList(): HTMLIFrameElement[] {
    return [...frames.querySelectorAll("iframe")];
  }

  current = {
    tabs,
    editorFrames,
    strip,
    frames,
    home,
    page,
    itemValues: () => [...strip.children].map(
      (item) => String(Reflect.get(item, "value"))
    ),
    tabStatus: (id) => String(Reflect.get(
      [...strip.children].find(
        (item) => Reflect.get(item, "value") === id
      ) ?? {},
      "status"
    )),
    findFrame: (id) => {
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

export function disposeHarness(): void {
  current?.tabs.dispose();
  current?.editorFrames.dispose();
  current = undefined;
  document.body.replaceChildren();
}
