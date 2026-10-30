// Import Third-party Dependencies
import {
  bindPresenceStack,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";

// Import Internal Dependencies
import type {
  TerrainAccess,
  TerrainGrants
} from "../access/TerrainAccess.ts";
import type { TerrainEditing } from "../editing/TerrainEditing.ts";
import "../features/overlays/toolbar/OverlayToolbar.ts";
import "../features/sculpt/toolbar/SculptToolbar.ts";
import { mountEditorPanels } from "./EditorPanels.ts";

// CONSTANTS
const kAccessElements = [
  "terrain-sculpt-toolbar",
  "terrain-material-palette",
  "terrain-poi-panel",
  "terrain-exchange-panel"
].join(",");

export interface EditorShellOptions {
  context: RuntimeEditorContext;
  editing: TerrainEditing;
  teleportToPeer: (clientId: string) => void;
}

export function mountEditorShell(
  { context, editing, teleportToPeer }: EditorShellOptions,
  disposables: Array<() => void>
): void {
  const toolbar = document.querySelector("jolly-editor-toolbar");
  if (toolbar !== null) {
    toolbar.sources = context.toolbar;
  }

  const activityLog = document.querySelector("jolly-log");
  if (activityLog !== null) {
    disposables.push(editing.log.subscribe((entries) => {
      activityLog.entries = entries;
    }));
  }

  mountToolbars(editing, disposables);
  mountEditorPanels(context.session, editing, disposables);
  disposables.push(publishAccess(editing.access));

  const presenceStack = document.querySelector("jolly-presence-stack");
  if (presenceStack !== null) {
    disposables.push(bindPresenceStack(presenceStack, editing.presence, teleportToPeer));
  }
}

function mountToolbars(
  { sculpt, history, shortcuts, keyBindings, overlaySettings }: TerrainEditing,
  disposables: Array<() => void>
): void {
  const sculptToolbar = document.querySelector("terrain-sculpt-toolbar");
  if (sculptToolbar !== null) {
    sculptToolbar.settings = sculpt;
    sculptToolbar.history = history;
    sculptToolbar.shortcuts = shortcuts;
    disposables.push(
      keyBindings.subscribe("change", () => sculptToolbar.requestUpdate()),
      () => {
        sculptToolbar.settings = null;
        sculptToolbar.history = null;
        sculptToolbar.shortcuts = null;
      }
    );
  }

  const overlayToolbar = document.querySelector("terrain-overlay-toolbar");
  if (overlayToolbar !== null) {
    overlayToolbar.settings = overlaySettings;
    disposables.push(() => {
      overlayToolbar.settings = null;
    });
  }
}

function publishAccess(
  access: TerrainGrants
): () => void {
  const elements = document.querySelectorAll<HTMLElement & { access: TerrainAccess; }>(kAccessElements);
  function publish(): void {
    for (const element of elements) {
      element.access = access.current;
    }
  }
  publish();

  return access.subscribe("change", publish);
}
