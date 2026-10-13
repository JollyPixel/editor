// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  TagName,
  type AssetTag,
  type CatalogClient,
  type CatalogClientEvents,
  type RestoreReport
} from "@jolly-pixel/asset-server/client";
import {
  showConfirm,
  type ConfirmOptions
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { LaunchNavigator } from "../launch/LaunchNavigator.ts";
import {
  askNewTag,
  type NewTag
} from "./dialogs/askNewTag.ts";

// CONSTANTS
const kDomTagsBrowser: EditorTagsBrowser = {
  askNewTag,
  confirm: showConfirm
};

export type EditorTagsEvents = {
  change: () => void;
};

type TagsChangedListener = CatalogClientEvents["tags-changed"];

export interface EditorTagsCatalog extends Pick<
  CatalogClient,
  "tags" | "tag" | "untag" | "restore"
> {
  subscribe(
    type: "tags-changed",
    listener: TagsChangedListener
  ): () => void;
}

export interface EditorTagsBrowser {
  askNewTag(): Promise<NewTag | null>;
  confirm(
    options: ConfirmOptions
  ): Promise<boolean>;
}

export interface EditorTagsOptions {
  catalog: EditorTagsCatalog;
  assetId: string;
  /**
   * The tag the editor shows instead of the current version.
   */
  viewing: string | null;
  unsaved(): boolean;
  navigator: LaunchNavigator;
  /**
   * @default the DOM dialogs
   */
  browser?: EditorTagsBrowser;
}

export class EditorTags extends Emitter<EditorTagsEvents> {
  readonly assetId: string;
  readonly viewing: string | null;

  readonly #catalog: EditorTagsCatalog;
  readonly #unsaved: () => boolean;
  readonly #navigator: LaunchNavigator;
  readonly #browser: EditorTagsBrowser;
  readonly #unsubscribe: () => void;
  #tags: readonly AssetTag[] = [];
  #loading: Promise<void> | null = null;

  constructor(
    options: EditorTagsOptions
  ) {
    super();

    this.assetId = options.assetId;
    this.viewing = options.viewing;
    this.#catalog = options.catalog;
    this.#unsaved = options.unsaved;
    this.#navigator = options.navigator;
    this.#browser = options.browser ?? kDomTagsBrowser;
    this.#unsubscribe = this.#catalog.subscribe(
      "tags-changed",
      (assetId, tags) => {
        if (assetId === this.assetId) {
          this.#replace(tags);
        }
      }
    );
  }

  * [Symbol.iterator](): IterableIterator<AssetTag> {
    yield* this.#newestFirst(
      (tag) => !TagName.isRestorePoint(tag.name)
    );
  }

  * restorePoints(): IterableIterator<AssetTag> {
    yield* this.#newestFirst(
      (tag) => TagName.isRestorePoint(tag.name)
    );
  }

  load(): Promise<void> {
    this.#loading ??= this.#catalog.tags(this.assetId).then(
      (tags) => this.#replace(tags),
      (error: unknown) => {
        this.#loading = null;

        throw error;
      }
    );

    return this.#loading;
  }

  async create(): Promise<AssetTag | null> {
    const requested = await this.#browser.askNewTag();
    if (requested === null) {
      return null;
    }

    const name = TagName.parse(requested.name);
    if (!name.ok) {
      throw name.val;
    }

    return this.#catalog.tag(
      this.assetId,
      name.val.value,
      requested.message === "" ? undefined : requested.message
    );
  }

  async restore(
    name: string
  ): Promise<RestoreReport | null> {
    const unsaved = this.#unsaved() ?
      " Changes not saved yet are lost." :
      "";
    const confirmed = await this.#browser.confirm({
      title: "Restore tag",
      message: `Replace the content of this asset with tag "${name}"? ` +
        `The current content is kept as a restore point.${unsaved}`,
      confirmLabel: "Restore",
      danger: true
    });
    if (!confirmed) {
      return null;
    }

    const report = await this.#catalog.restore(this.assetId, name);
    if (this.viewing !== null) {
      await this.view(null);
    }

    return report;
  }

  async delete(
    name: string
  ): Promise<boolean> {
    const confirmed = await this.#browser.confirm({
      title: "Delete tag",
      message: `Delete tag "${name}"? The asset content does not change.`,
      confirmLabel: "Delete",
      danger: true
    });
    if (!confirmed) {
      return false;
    }

    await this.#catalog.untag(this.assetId, name);
    if (name === this.viewing) {
      await this.view(null);
    }

    return true;
  }

  async view(
    name: string | null
  ): Promise<void> {
    if (name !== this.viewing) {
      await this.#navigator.navigate(this.assetId, name);
    }
  }

  dispose(): void {
    this.#unsubscribe();
  }

  #replace(
    tags: readonly AssetTag[]
  ): void {
    this.#tags = tags;
    this.emit("change");
  }

  * #newestFirst(
    filter: (tag: AssetTag) => boolean
  ): IterableIterator<AssetTag> {
    yield* this.#tags
      .filter(filter)
      .sort((left, right) => right.eventVersion - left.eventVersion);
  }
}
