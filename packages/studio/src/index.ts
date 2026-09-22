// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
  CatalogClient,
  catalogRoom
} from "@jolly-pixel/asset-server/catalog/client";
import { IDENTITY_STORAGE_KEY } from "@jolly-pixel/editor.host";
import { Client } from "@jolly-pixel/network/client";
import {
  promptPeerIdentity,
  showConfirm
} from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import { kindIcon } from "./icons.ts";
import {
  StudioShell,
  type AssetTreeElement
} from "./shell/StudioShell.ts";
import {
  EditorTabs,
  type TabStrip
} from "./tabs/EditorTabs.ts";

// CONSTANTS
const kIdentityTitle = "Join studio";

declare global {
  interface Window {
    studio?: StudioShell;
  }
}

function required<TElement extends Element>(
  selector: string
): TElement {
  const element = document.querySelector<TElement>(selector);
  if (element === null) {
    throw new Error(`Missing shell element "${selector}".`);
  }

  return element;
}

async function boot(): Promise<void> {
  const identity = await promptPeerIdentity({
    title: kIdentityTitle,
    storageKey: IDENTITY_STORAGE_KEY
  });
  const client = new Client({
    profile: toPeerMetadata(identity)
  });
  const catalog = new CatalogClient(catalogRoom(client));
  await catalog.ready;

  const tabs = new EditorTabs({
    strip: required<TabStrip>("#editor-tabs"),
    frames: required("#editor-frames"),
    confirmEvict: (tab) => showConfirm({
      title: "Editor limit reached",
      message: `Close "${tab.label}" to open another editor?`,
      confirmLabel: "Close"
    }),
    onShellCommand: (command) => shell.handleShellCommand(command)
  });
  const shell = new StudioShell({
    catalog,
    tree: required<AssetTreeElement>("#asset-tree"),
    tabs,
    iconFor: kindIcon
  });

  if (import.meta.env.DEV) {
    window.studio = shell;
  }
}

void boot();
