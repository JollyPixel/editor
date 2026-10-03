// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EditorFrames } from "../../src/tabs/EditorFrames.ts";
import { idleShare } from "./catalogShare.ts";
import {
  EditorTabs,
  type EditorTab,
  type EditorTabsOptions
} from "../../src/tabs/EditorTabs.ts";

// CONSTANTS
export const MAP_TAB: EditorTab = {
  id: "map-1",
  label: "overworld.voxelmap.json",
  url: "/editors/voxel-map/?target=map-1"
};
export const MODEL_TAB: EditorTab = {
  id: "model-1",
  label: "model.voxelmodel.json",
  url: "/editors/voxel-model/?target=model-1"
};
export const OTHER_TAB: EditorTab = {
  id: "map-2",
  label: "cave.voxelmap.json",
  url: "/editors/voxel-map/?target=map-2"
};

interface Harness {
  tabs: EditorTabs;
  editorFrames: EditorFrames;
  strip: HTMLElement & { value: string; };
  frames: HTMLElement;
  home: HTMLElement;
  itemValues(): string[];
  frameOf(id: string): HTMLIFrameElement;
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
  document.body.append(strip, frames, home);
  const editorFrames = new EditorFrames({
    container: frames,
    share: idleShare()
  });
  const tabs = new EditorTabs({
    strip,
    frames: editorFrames,
    home,
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

export function disposeHarness(): void {
  current?.tabs.dispose();
  current?.editorFrames.dispose();
  current = undefined;
  document.body.replaceChildren();
}
