// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  CATALOG_RESTORE,
  CATALOG_TAG,
  CATALOG_UNTAG,
  TagName,
  type AssetTag,
  type CatalogClient,
  type CatalogClientEvents,
  type RestoreReport
} from "@jolly-pixel/asset-server/client";
import type { ConfirmOptions } from "@jolly-pixel/ui";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";

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
  "tags" | "tag" | "untag" | "restore" | "can"
> {
  subscribe(
    type: "tags-changed",
    listener: TagsChangedListener
  ): () => void;
  subscribe(
    type: "rights",
    listener: () => void
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
  readonly #unsubscribe: Array<() => void>;
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
    this.#unsubscribe = [
      this.#catalog.subscribe(
        "tags-changed",
        (assetId, tags) => {
          if (assetId === this.assetId) {
            this.#replace(tags);
          }
        }
      ),
      this.#catalog.subscribe("rights", () => this.emit("change"))
    ];
  }

  get canTag(): boolean {
    return this.#catalog.can(CATALOG_TAG);
  }

  get canUntag(): boolean {
    return this.#catalog.can(CATALOG_UNTAG);
  }

  get canRestore(): boolean {
    return this.#catalog.can(CATALOG_RESTORE);
  }

  * [Symbol.iterator](): IterableIterator<AssetTag> {
    yield* this.#newestFirst(
      (tag) => !TagName.isReserved(tag.name)
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
    if (!this.canTag) {
      return null;
    }

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
    if (!this.canRestore) {
      return null;
    }

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
    if (!this.canUntag) {
      return false;
    }

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
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
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
