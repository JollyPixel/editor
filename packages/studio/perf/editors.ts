// Import Node.js Dependencies
import path from "node:path";

// CONSTANTS
const kEditorsRoot = path.join(import.meta.dirname, "..", "..", "editors");

export const STUDIO_URL = "http://localhost:3004/";
export const DEBUG_STORAGE_KEY = "jolly-pixel:debug";
export const EXPANDED_STORAGE_KEY = "studio:asset-expanded";
export const SEED_FOLDERS = ["folder:maps", "folder:models"];

export type EditorName = "voxel-map" | "voxel-model" | "pixel-art";
export type StudioMode = "online" | "offline";

export interface BenchEditor {
  name: EditorName;
  row: string;
  tab: string;
  dist: string;
}

export const EDITORS: Record<EditorName, BenchEditor> = {
  "voxel-map": {
    name: "voxel-map",
    row: "overworld.voxelmap.json",
    tab: "overworld",
    dist: path.join(kEditorsRoot, "voxel-map", "dist")
  },
  "voxel-model": {
    name: "voxel-model",
    row: "model.voxelmodel.json",
    tab: "model",
    dist: path.join(kEditorsRoot, "voxel-model", "dist")
  },
  "pixel-art": {
    name: "pixel-art",
    row: "model.pixelart",
    tab: "model",
    dist: path.join(kEditorsRoot, "pixel-art", "dist-page")
  }
};

export function parseEditors(
  value: string
): BenchEditor[] {
  return value.split(",").map((name) => {
    const editor = EDITORS[name as EditorName];
    if (editor === undefined) {
      throw new Error(`Unknown editor "${name}"`);
    }

    return editor;
  });
}

export function editorOfUrl(
  url: string
): BenchEditor | null {
  const match = /\/editors\/([\w-]+)\//.exec(url);

  return match === null ? null : EDITORS[match[1] as EditorName] ?? null;
}

export function editorFrameSelector(
  editor: BenchEditor
): string {
  return `#editor-frames iframe[src^="editors/${editor.name}/"]`;
}
