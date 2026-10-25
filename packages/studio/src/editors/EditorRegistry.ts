// Import Third-party Dependencies
import type { LoadedAssetKind } from "@jolly-pixel/asset-server";
import { registerKindIcon } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  AssetKindSet,
  type AssetKindEntry
} from "../catalog/AssetKindSet.ts";
import {
  EDITOR_PAGES_PATH,
  type EditorDescriptor
} from "../../shared/EditorDescriptor.ts";

// CONSTANTS
const kTargetParam = "target";

export interface EditorRegistryOptions {
  /**
   * Parameters added to every page URL, before the target.
   */
  query?: Readonly<Record<string, string>>;
  /**
   * @default EDITOR_PAGES_PATH
   */
  prefix?: string;
}

export class EditorRegistry {
  #kinds = new Map<string, AssetKindEntry>();
  #editors = new Map<string, EditorDescriptor>();
  #query: Readonly<Record<string, string>>;
  #prefix: string;

  constructor(
    options: EditorRegistryOptions = {}
  ) {
    this.#query = { ...options.query };
    this.#prefix = options.prefix ?? EDITOR_PAGES_PATH;
  }

  registerKind(
    descriptor: LoadedAssetKind
  ): this {
    const { kind } = descriptor;
    if (this.#kinds.has(kind)) {
      throw new TypeError(`Asset kind "${kind}" is already registered.`);
    }

    this.#kinds.set(kind, {
      kind,
      label: descriptor.label,
      extension: descriptor.extension,
      icon: registerKindIcon(descriptor),
      convertsFrom: descriptor.convertsFrom
    });

    return this;
  }

  registerEditor(
    editor: EditorDescriptor
  ): this {
    for (const kind of editor.kinds) {
      const registered = this.#editors.get(kind);
      if (registered !== undefined) {
        throw new TypeError(
          `Asset kind "${kind}" already opens in editor "${registered.name}".`
        );
      }
    }

    const descriptor: EditorDescriptor = {
      name: editor.name,
      kinds: [...editor.kinds]
    };
    for (const kind of descriptor.kinds) {
      this.#editors.set(kind, descriptor);
    }

    return this;
  }

  kindSet(): AssetKindSet {
    return new AssetKindSet({
      kinds: this.#kinds.values(),
      editable: this.#editors.keys()
    });
  }

  findEditor(
    kind: string
  ): EditorDescriptor | undefined {
    return this.#editors.get(kind);
  }

  pageUrl(
    editor: string,
    target: string
  ): string {
    const query = new URLSearchParams({
      ...this.#query,
      [kTargetParam]: target
    });

    return `${this.#prefix}${editor}/?${query}`;
  }
}
