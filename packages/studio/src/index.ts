// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { PIXEL_ART_ASSET } from "@jolly-pixel/asset.pixel-art";
import { VOXEL_MAP_ASSET } from "@jolly-pixel/asset.voxel-map";
import { VOXEL_MODEL_ASSET } from "@jolly-pixel/asset.voxel-model";
import {
  CATALOG_ROOM,
  CatalogClient,
  catalogRoom
} from "@jolly-pixel/asset-server/catalog/client";
import {
  IDENTITY_STORAGE_KEY,
  rememberQueryUsername
} from "@jolly-pixel/editor.host";
import { Client } from "@jolly-pixel/network/client";
import {
  promptPeerIdentity,
  showChoice,
  showConfirm
} from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";
import editors from "virtual:jolly-pixel/editors";

// Import Internal Dependencies
import { EditorRegistry } from "./editors/EditorRegistry.ts";
import "./icons.ts";
import type { Studio } from "./shell/Studio.ts";
import "./shell/Studio.ts";

// CONSTANTS
const kIdentityTitle = "Join studio";
const kCatalogTimeoutMs = 5_000;
const kOfflineWorkspace = "studio";
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
  const offline = import.meta.env.MODE === "static" ||
    new URLSearchParams(location.search).has("offline");
  const connection = offline ?
    await connectOffline() :
    await connectWithOffer();
  const studio = required("jolly-studio");
  await studio.attach({
    catalog: connection.catalog,
    editors: createEditorRegistry(connection.offline),
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
  offline: boolean
): EditorRegistry {
  const registry = new EditorRegistry({
    query: offline ?
      {
        offline: "",
        workspace: kOfflineWorkspace
      } :
      {}
  });
  for (const descriptor of kAssetKinds) {
    registry.registerKind(descriptor);
  }
  for (const editor of editors) {
    registry.registerEditor(editor);
  }

  return registry;
}

interface StudioConnection {
  catalog: CatalogClient;
  offline: boolean;
}

async function connectOnline(): Promise<StudioConnection> {
  const identity = await promptPeerIdentity({
    title: kIdentityTitle,
    storageKey: IDENTITY_STORAGE_KEY
  });
  const client = new Client({
    profile: toPeerMetadata(identity)
  });
  const catalog = new CatalogClient(catalogRoom(client));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      catalog.ready,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("The asset catalog is unavailable.")),
          kCatalogTimeoutMs
        );
      })
    ]);
  }
  catch (error) {
    catalog.dispose();
    client.destroy();

    throw error;
  }
  finally {
    clearTimeout(timer);
  }

  return { catalog, offline: false };
}

async function connectOffline(): Promise<StudioConnection> {
  const { openStudioOfflineWorkspace } =
    await import("./offlineWorkspace.ts");
  const workspace = await openStudioOfflineWorkspace();
  const connection = workspace.connect();
  const catalog = new CatalogClient(
    connection.client.room(CATALOG_ROOM)
  );
  try {
    await catalog.ready;
  }
  catch (error) {
    catalog.dispose();
    connection.client.destroy();

    throw error;
  }

  return { catalog, offline: true };
}

async function connectWithOffer(): Promise<StudioConnection> {
  for (;;) {
    try {
      return await connectOnline();
    }
    catch (error) {
      const choice = await showChoice<"retry" | "offline">({
        title: "Connection unavailable",
        message: "The asset catalog is unreachable.",
        actions: [
          { value: "retry", label: "Retry" },
          { value: "offline", label: "Open offline workspace" }
        ],
        focus: "retry"
      });
      if (choice === "offline") {
        return connectOffline();
      }
      if (choice === null) {
        throw error;
      }
    }
  }
}

void boot();
