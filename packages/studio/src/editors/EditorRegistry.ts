// Import Third-party Dependencies
import { registerKindIcon } from "@jolly-pixel/editor.host";
import {
  EDITOR_PAGES_PATH,
  PREVIEW_PAGE_PATH,
  type EditorDescriptor,
  type ManifestKind
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  AssetKindSet,
  type AssetKindEntry
} from "../catalog/AssetKindSet.ts";

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
  maxContentBytes: number;
}

export class EditorRegistry {
  #kinds = new Map<string, AssetKindEntry>();
  #editors = new Map<string, EditorDescriptor>();
  #query: Readonly<Record<string, string>>;
  #prefix: string;
  #maxContentBytes: number;

  constructor(
    options: EditorRegistryOptions
  ) {
    this.#query = { ...options.query };
    this.#prefix = options.prefix ?? EDITOR_PAGES_PATH;
    this.#maxContentBytes = options.maxContentBytes;
  }

  registerKind(
    descriptor: ManifestKind
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
      creatable: descriptor.creatable,
      convertsFrom: descriptor.convertsFrom,
      extensions: descriptor.extensions,
      maxContentBytes: descriptor.maxContentBytes,
      preview: descriptor.preview
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
      editable: this.#editors.keys(),
      maxContentBytes: this.#maxContentBytes
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

  previewUrl(): string {
    const query = new URLSearchParams(this.#query);

    return query.size === 0 ?
      PREVIEW_PAGE_PATH :
      `${PREVIEW_PAGE_PATH}?${query}`;
  }
}
