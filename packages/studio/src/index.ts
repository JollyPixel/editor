// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { PIXEL_ART_ASSET } from "@jolly-pixel/asset.pixel-art";
import { VOXEL_MAP_ASSET } from "@jolly-pixel/asset.voxel-map";
import { VOXEL_MODEL_ASSET } from "@jolly-pixel/asset.voxel-model";
import { rememberQueryUsername } from "@jolly-pixel/editor.host";
import { showConfirm } from "@jolly-pixel/ui";
import editors from "virtual:jolly-pixel/editors";

// Import Internal Dependencies
import { connectStudio } from "./connection.ts";
import { EditorRegistry } from "./editors/EditorRegistry.ts";
import "./icons.ts";
import type { Studio } from "./shell/Studio.ts";
import "./shell/Studio.ts";

// CONSTANTS
const kAssetKinds = [
  PIXEL_ART_ASSET,
  VOXEL_MAP_ASSET,
  VOXEL_MODEL_ASSET
];

declare global {
  interface Window {
    studio?: Studio;
  }
}

function required<TName extends keyof HTMLElementTagNameMap>(
  selector: TName
): HTMLElementTagNameMap[TName] {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`Missing shell element "${selector}".`);
  }

  return element;
}

async function boot(): Promise<void> {
  if (import.meta.env.DEV) {
    rememberQueryUsername();
  }
  const connection = await connectStudio();
  const studio = required("jolly-studio");
  await studio.attach({
    catalog: connection.catalog,
    editors: createEditorRegistry(connection.editorQuery),
    confirmEvict: (tab) => showConfirm({
      title: "Editor limit reached",
      message: `Close "${tab.label}" to open another editor?`,
      confirmLabel: "Close"
    })
  });

  if (import.meta.env.DEV) {
    window.studio = studio;
  }
}

function createEditorRegistry(
  query: Readonly<Record<string, string>>
): EditorRegistry {
  const registry = new EditorRegistry({ query });
  for (const descriptor of kAssetKinds) {
    registry.registerKind(descriptor);
  }
  for (const editor of editors) {
    registry.registerEditor(editor);
  }

  return registry;
}

void boot();
