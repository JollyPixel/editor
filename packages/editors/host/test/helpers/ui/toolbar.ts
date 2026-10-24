// Import Node.js Dependencies
import { setTimeout } from "node:timers/promises";

// Import Third-party Dependencies
import { Lantern } from "@jolly-pixel/lantern";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { EditorToolbar } from "#src/ui/index.ts";
import "#src/ui/index.ts";
import type { EditorTargets } from "#src/session/EditorTargets.ts";
import type { EditorTags } from "#src/session/EditorTags.ts";
import {
  EditorToolbarSources,
  type EditorToolbarArchives
} from "#src/session/EditorToolbarSources.ts";
import { createToolbarArchives } from "../session/archives.ts";

export interface MountToolbarOptions {
  lantern?: Lantern;
  archives?: EditorToolbarArchives;
}

export async function mountToolbar(
  targets: EditorTargets | null,
  tags: EditorTags | null,
  options: MountToolbarOptions = {}
): Promise<EditorToolbar> {
  const {
    lantern = new Lantern({ storage: new MemoryStorageAdapter() }),
    archives = createToolbarArchives()
  } = options;
  const element = document.createElement("jolly-editor-toolbar");
  element.sources = new EditorToolbarSources({
    targets,
    tags,
    archives,
    lantern
  });
  document.body.append(element);
  await setTimeout();
  await element.updateComplete;

  return element;
}

export function query<TElement extends Element = HTMLElement>(
  element: EditorToolbar,
  selector: string
): TElement | null {
  return element.shadowRoot!.querySelector<TElement>(selector);
}

export function pick(
  select: Element,
  value: string
): void {
  select.dispatchEvent(new CustomEvent("jolly-change", {
    detail: { value }
  }));
}
