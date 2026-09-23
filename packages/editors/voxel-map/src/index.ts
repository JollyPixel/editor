// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
  CatalogUnavailableError,
  LaunchNotFoundError,
  mountStandalone,
  type MountStandaloneOptions
} from "@jolly-pixel/editor.host";
import { showChoice } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  VOXEL_MAP_PARAMS,
  VoxelMapEditor
} from "./boot/VoxelMapEditor.ts";
import "./app/sidebarIcons.ts";

// CONSTANTS
const kDebugOptions = {
  dev: import.meta.env.DEV,
  debugHandle: "voxelMapEditor"
};

declare global {
  interface Window {
    voxelMapEditor?: VoxelMapEditor;
  }
}

async function offlineOptions(): Promise<MountStandaloneOptions> {
  const { openOfflineWorkspace } = await import("./boot/offlineWorkspace.ts");
  const name = new URLSearchParams(location.search).get("workspace") ??
    "default";
  const workspace = await openOfflineWorkspace(name);

  return {
    sources: await workspace.launchSources(VoxelMapEditor.accepts),
    connect: () => workspace.connect()
  };
}

async function boot(): Promise<void> {
  if (
    VOXEL_MAP_PARAMS.read().offline ||
    import.meta.env.MODE === "static"
  ) {
    await mountStandalone(VoxelMapEditor, {
      ...await offlineOptions(),
      ...kDebugOptions
    });

    return;
  }

  for (;;) {
    try {
      await mountStandalone(VoxelMapEditor, kDebugOptions);

      return;
    }
    catch (error) {
      if (
        !(error instanceof CatalogUnavailableError) &&
        !(error instanceof LaunchNotFoundError)
      ) {
        throw error;
      }
      const choice = await showChoice<"retry" | "offline">({
        title: "Connection unavailable",
        message: "The asset server is unreachable.",
        actions: [
          { value: "retry", label: "Retry" },
          { value: "offline", label: "Open offline workspace" }
        ],
        focus: "retry"
      });
      if (choice === "offline") {
        await mountStandalone(VoxelMapEditor, {
          ...await offlineOptions(),
          ...kDebugOptions
        });

        return;
      }
      if (choice === null) {
        throw error;
      }
    }
  }
}

void boot();
