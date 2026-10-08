// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { ADMIN_ROLE } from "@jolly-pixel/accounts";
import { mountConsole } from "@jolly-pixel/editor.host";
import { showConfirm } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { usersConsole } from "./accounts/usersConsole.ts";
import { connectStudio } from "./connection.ts";
import {
  EDITOR_PAGE_REBUILT_EVENT,
  type EditorPageRebuilt
} from "./editors/EditorDescriptor.ts";
import { ProjectManifest } from "./editors/ProjectManifest.ts";
import { EditorRegistry } from "./editors/EditorRegistry.ts";
import "./icons.ts";
import type { Studio } from "./shell/Studio.ts";
import "./shell/Studio.ts";

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
  const editorConsole = mountConsole();
  const [connection, manifest] = await Promise.all([
    connectStudio(),
    ProjectManifest.fetch(document.baseURI)
  ]);
  const studio = required("jolly-studio");
  await studio.attach({
    console: editorConsole,
    share: connection.share,
    identity: connection.identity,
    signedIn: connection.signedIn,
    editors: createEditorRegistry(manifest, connection.editorQuery),
    confirmEvict: (tab) => showConfirm({
      title: "Editor limit reached",
      message: `Close "${tab.label}" to open another editor?`,
      confirmLabel: "Close"
    })
  });

  if (connection.signedIn?.account.role === ADMIN_ROLE) {
    usersConsole(
      editorConsole.commands,
      connection.signedIn.roster
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
