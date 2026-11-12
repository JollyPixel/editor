// Import Third-party Dependencies
import {
  PageAppearance,
  mountConsole
} from "@jolly-pixel/editor.host";
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/scope";
import {
  ProjectManifest,
  PreferenceScopes
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { usersConsole } from "./accounts/usersConsole.ts";
import { connectStudio } from "./connection/StudioConnection.ts";
import {
  EDITOR_PAGE_REBUILT_EVENT,
  type EditorPageRebuilt
} from "../shared/editorPageRebuilt.ts";
import {
  SHELL_PREFERENCES,
  STUDIO_PREFERENCES
} from "../shared/preferences.ts";
import { EditorRegistry } from "./editors/EditorRegistry.ts";
import { EditorPrefetch } from "./editors/EditorPrefetch.ts";
import "./icons.ts";
import { StudioAppearance } from "./preferences/StudioAppearance.ts";
import { SettingsSections } from "./shell/settings/SettingsSections.ts";
import { settingsConsole } from "./shell/settings/settingsConsole.ts";
import { golemConsole } from "./shell/golem/golemConsole.ts";
import type { Studio } from "./shell/Studio.ts";
import "./shell/Studio.ts";
import type { EditorTab } from "./tabs/EditorTabs.ts";

declare global {
  interface Window {
    studio?: Studio;
  }
  interface Navigator {
    readonly connection?: {
      readonly saveData?: boolean;
    };
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

function unsavedChanges(
  tab: EditorTab
): string {
  return `"${tab.label}" has changes the server has not received.`;
}

function prewarmWebGPU(): void {
  if ("gpu" in navigator) {
    void navigator.gpu.requestAdapter().catch(() => null);
  }
}

async function boot(): Promise<void> {
  prewarmWebGPU();
  const appearance = new StudioAppearance({
    page: new PageAppearance(document),
    hint: new LocalStorageAdapter()
  });
  const editorConsole = mountConsole({ appearance });
  const [connection, manifest] = await Promise.all([
    connectStudio(),
    ProjectManifest.fetch(document.baseURI)
  ]);
  const { user } = connection;
  const { preferences } = user;
  appearance.follow(preferences);
  const scopes = new PreferenceScopes(
    SHELL_PREFERENCES,
    manifest.editorScopes()
  );
  const editors = createEditorRegistry(manifest, connection.editorQuery);
  const settings = new SettingsSections({
    user,
    shellScopes: [...SHELL_PREFERENCES.scopes, ...SHELL_PREFERENCES.common],
    editors: manifest.editorScopes(),
    kindPackages: manifest.kindPackages,
    kinds: editors.kindSet()
  });
  const studio = required("jolly-studio");
  await studio.attach({
    console: editorConsole,
    share: connection.share,
    user,
    scopes,
    settings,
    editors,
    confirmEvict: (tab, unsaved) => showConfirm({
      title: "Editor limit reached",
      message: unsaved ?
        `${unsavedChanges(tab)} Close it anyway to open another editor?` :
        `Close "${tab.label}" to open another editor?`,
      confirmLabel: "Close",
      danger: unsaved
    }),
    confirmClose: (tab) => showConfirm({
      title: "Unsaved changes",
      message: `${unsavedChanges(tab)} Closing the tab loses them.`,
      confirmLabel: "Close",
      danger: true
    })
  });

  settingsConsole(editorConsole.commands, studio, settings);
  if (user.online && user.rights.allows("manageAccess")) {
    usersConsole(editorConsole.commands, user.roster);
  }
  if (user.online) {
    golemConsole(editorConsole.commands, studio);
  }

  if (
    preferences.values(STUDIO_PREFERENCES).prefetchEditors &&
    navigator.connection?.saveData !== true
  ) {
    whenIdle(
      () => void new EditorPrefetch(manifest.editors, document.baseURI).run()
    );
  }

  if (import.meta.env.DEV) {
    window.studio = studio;
  }
  import.meta.hot?.on(
    EDITOR_PAGE_REBUILT_EVENT,
    (page: EditorPageRebuilt) => studio.reloadEditor(page.name)
  );
}

function whenIdle(
  task: () => void
): void {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(task);
  }
  else {
    setTimeout(task);
  }
}

function createEditorRegistry(
  manifest: ProjectManifest,
  query: Readonly<Record<string, string>>
): EditorRegistry {
  const registry = new EditorRegistry({
    query,
    maxContentBytes: manifest.maxContentBytes
  });
  for (const descriptor of manifest.kinds) {
    registry.registerKind(descriptor);
  }
  for (const editor of manifest.editors) {
    registry.registerEditor(editor);
  }

  return registry;
}

void boot();
