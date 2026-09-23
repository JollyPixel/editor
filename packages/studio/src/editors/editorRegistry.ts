// Import Third-party Dependencies
import { VOXEL_MAP_KIND } from "@jolly-pixel/asset.voxel-map";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model";

// CONSTANTS
export const EDITOR_PAGES: ReadonlyMap<string, string> = new Map([
  [VOXEL_MAP_KIND, "/editors/voxel-map/"],
  [VOXEL_MODEL_KIND, "/editors/voxel-model/"]
]);
const kTargetParam = "target";

export function editorPageFor(
  kind: string,
  pages: ReadonlyMap<string, string> = EDITOR_PAGES
): string | undefined {
  return pages.get(kind);
}

export function editorPageUrl(
  page: string,
  target: string
): string {
  const query = new URLSearchParams({ [kTargetParam]: target });

  return `${page}${page.includes("?") ? "&" : "?"}${query}`;
}

export function offlineEditorPages(
  workspace: string
): ReadonlyMap<string, string> {
  const query = new URLSearchParams({
    offline: "",
    workspace
  });

  return new Map(
    [...EDITOR_PAGES].map(([kind, page]) => [
      kind,
      `${page}?${query}`
    ])
  );
}
