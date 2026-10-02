// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
  mountConsole,
  rememberQueryUsername
} from "@jolly-pixel/editor.host";
import { showConfirm } from "@jolly-pixel/ui";
import {
  editors,
  kinds
} from "virtual:jolly-pixel/project";

// Import Internal Dependencies
import { connectStudio } from "./connection.ts";
import {
  EDITOR_PAGE_REBUILT_EVENT,
  type EditorPageRebuilt
} from "./editors/EditorDescriptor.ts";
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
  const connection = await connectStudio();
  const studio = required("jolly-studio");
  await studio.attach({
    console: editorConsole,
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
  import.meta.hot?.on(
    EDITOR_PAGE_REBUILT_EVENT,
    (page: EditorPageRebuilt) => studio.reloadEditor(page.name)
  );
}

function createEditorRegistry(
  query: Readonly<Record<string, string>>
): EditorRegistry {
  const registry = new EditorRegistry({ query });
  for (const descriptor of kinds) {
    registry.registerKind(descriptor);
  }
  for (const editor of editors) {
    registry.registerEditor(editor);
  }

  return registry;
}

void boot();
