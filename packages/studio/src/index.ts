// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
  PageAppearance,
  mountConsole
} from "@jolly-pixel/editor.host";
import {
  LocalStorageAdapter,
  showConfirm
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { usersConsole } from "./accounts/usersConsole.ts";
import { connectStudio } from "./connection.ts";
import {
  EDITOR_PAGE_REBUILT_EVENT,
  type EditorPageRebuilt
} from "./editors/EditorDescriptor.ts";
import { ProjectManifest } from "./editors/ProjectManifest.ts";
import { EditorRegistry } from "./editors/EditorRegistry.ts";
import { EditorPrefetch } from "./editors/EditorPrefetch.ts";
import "./icons.ts";
import {
  PreferenceScopes,
  SHELL_PREFERENCES
} from "./preferences/PreferenceScopes.ts";
import { StudioAppearance } from "./preferences/StudioAppearance.ts";
import { STUDIO_PREFERENCES } from "./preferences/studioScope.ts";
import { SettingsSections } from "./shell/settings/SettingsSections.ts";
import { settingsConsole } from "./shell/settings/settingsConsole.ts";
import type { Studio } from "./shell/Studio.ts";
import "./shell/Studio.ts";

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
  const { preferences } = connection;
  appearance.follow(preferences);
  const scopes = PreferenceScopes.studio(manifest.preferences());
  const editors = createEditorRegistry(manifest, connection.editorQuery);
  const settings = new SettingsSections({
    signedIn: connection.signedIn !== null,
    shellScopes: SHELL_PREFERENCES,
    editors: manifest.editorScopes(),
    kindPackages: manifest.kindPackages,
    kinds: editors.kindSet(),
    project: connection.signedIn?.project.rights
  });
  const studio = required("jolly-studio");
  await studio.attach({
    console: editorConsole,
    share: connection.share,
    signedIn: connection.signedIn,
    preferences,
    scopes,
    settings,
    editors,
    confirmEvict: (tab) => showConfirm({
      title: "Editor limit reached",
      message: `Close "${tab.label}" to open another editor?`,
      confirmLabel: "Close"
    })
  });

  settingsConsole(editorConsole.commands, studio, settings);
  if (connection.signedIn?.isAdmin) {
    usersConsole(
      editorConsole.commands,
      connection.signedIn.roster
    );
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
  const registry = new EditorRegistry({ query });
  for (const descriptor of manifest.kinds) {
    registry.registerKind(descriptor);
  }
  for (const editor of manifest.editors) {
    registry.registerEditor(editor);
  }

  return registry;
}

void boot();
