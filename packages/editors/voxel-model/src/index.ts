// Import Third-party Dependencies
import {
  CatalogUnavailableError,
  LaunchNotFoundError,
  mountStandalone,
  type MountStandaloneOptions
} from "@jolly-pixel/editor.host";
import { showChoice } from "@jolly-pixel/ui";

// Import Internal Dependencies
import "./app/paneIcons.ts";
import "./app/LeftPanel.ts";
import "./app/RightPanel.ts";
import { VoxelModelEditor } from "./boot/VoxelModelEditor.ts";

declare global {
  interface Window {
    voxelModelEditor?: VoxelModelEditor;
  }
}

async function offlineOptions(): Promise<MountStandaloneOptions> {
  const { openOfflineWorkspace } = await import("./boot/offlineWorkspace.ts");
  const name = new URLSearchParams(location.search).get("workspace") ??
    "default";
  const workspace = await openOfflineWorkspace(name);

  return {
    sources: await workspace.launchSources(VoxelModelEditor.accepts),
    connect: () => workspace.connect()
  };
}

async function boot(): Promise<void> {
  const debugHandle = import.meta.env.DEV ? "voxelModelEditor" : undefined;
  if (
    import.meta.env.MODE === "static" ||
      new URLSearchParams(location.search).has("offline")
  ) {
    await mountStandalone(VoxelModelEditor, {
      ...await offlineOptions(),
      debugHandle
    });

    return;
  }

  for (;;) {
    try {
      await mountStandalone(VoxelModelEditor, { debugHandle });

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
        await mountStandalone(VoxelModelEditor, {
          ...await offlineOptions(),
          debugHandle
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
