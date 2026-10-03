// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
  mountConsole,
  rememberQueryUsername
} from "@jolly-pixel/editor.host";
import { showConfirm } from "@jolly-pixel/ui";

// Import Internal Dependencies
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
  if (import.meta.env.DEV) {
    rememberQueryUsername();
  }
  const editorConsole = mountConsole();
  const [connection, manifest] = await Promise.all([
    connectStudio(),
    ProjectManifest.fetch(document.baseURI)
  ]);
  const studio = required("jolly-studio");
  await studio.attach({
    console: editorConsole,
    share: connection.share,
    editors: createEditorRegistry(manifest, connection.editorQuery),
    confirmEvict: (tab) => showConfirm({
      title: "Editor limit reached",
      message: `Close "${tab.label}" to open another editor?`,
      confirmLabel: "Close"
    })
  });

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
