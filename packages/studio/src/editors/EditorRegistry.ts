// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server/kinds";
import {
  isIconTone,
  registerIcon,
  type IconName
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  EDITOR_PAGES_PREFIX,
  type EditorDescriptor
} from "./EditorDescriptor.ts";

// CONSTANTS
const kTargetParam = "target";
const kKindIconPrefix = "kind:";
const kFallbackIcon: IconName = "file";

export interface EditorRegistryOptions {
  /**
   * Parameters added to every page URL, before the target.
   */
  query?: Readonly<Record<string, string>>;
  /**
   * @default EDITOR_PAGES_PREFIX
   */
  prefix?: string;
}

/**
 * Resolves the icon and the editor page of an asset kind. Registering a
 * kind twice, or a kind in two editors, throws.
 */
export class EditorRegistry {
  #kinds = new Map<string, AssetKindDescriptor>();
  #editors = new Map<string, EditorDescriptor>();
  #query: Readonly<Record<string, string>>;
  #prefix: string;

  constructor(
    options: EditorRegistryOptions = {}
  ) {
    this.#query = { ...options.query };
    this.#prefix = options.prefix ?? EDITOR_PAGES_PREFIX;
  }

  registerKind(
    descriptor: AssetKindDescriptor
  ): this {
    const { kind, icon } = descriptor;
    const tone = icon?.tone;
    if (this.#kinds.has(kind)) {
      throw new TypeError(`Asset kind "${kind}" is already registered.`);
    }
    if (tone !== undefined && !isIconTone(tone)) {
      throw new TypeError(
        `Asset kind "${kind}" declares an unknown icon tone "${tone}".`
      );
    }

    if (icon !== undefined) {
      registerIcon(`${kKindIconPrefix}${kind}`, icon.svg, { tone });
    }
    this.#kinds.set(kind, { ...descriptor });

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

  iconFor(
    kind: string
  ): IconName {
    return this.#kinds.get(kind)?.icon === undefined ?
      kFallbackIcon :
      `${kKindIconPrefix}${kind}`;
  }

  editorFor(
    kind: string
  ): EditorDescriptor | undefined {
    return this.#editors.get(kind);
  }

  pageUrl(
    kind: string,
    target: string
  ): string | undefined {
    const editor = this.#editors.get(kind);
    if (editor === undefined) {
      return undefined;
    }

    const query = new URLSearchParams({
      ...this.#query,
      [kTargetParam]: target
    });

    return `${this.#prefix}${editor.name}/?${query}`;
  }
}
