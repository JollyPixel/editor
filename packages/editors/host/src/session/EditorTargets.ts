// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  AssetPath,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type {
  ConfirmOptions,
  PromptOptions
} from "@jolly-pixel/ui";
import {
  showConfirm,
  showPrompt
} from "@jolly-pixel/ui/elements/dialog";

// Import Internal Dependencies
import type { LaunchNavigator } from "../launch/LaunchNavigator.ts";
import { LastTargetError } from "./errors/LastTargetError.ts";
import { TargetInUseError } from "./errors/TargetInUseError.ts";

// CONSTANTS
const kDomTargetsBrowser: EditorTargetsBrowser = {
  prompt: showPrompt,
  confirm: showConfirm
};
const kPathOrder = new Intl.Collator();

export type EditorTargetsEvents = {
  change: () => void;
};

export interface EditorTargetsCatalog extends Pick<
  CatalogClient,
  "records" | "record" | "listDependents" | "rename" | "remove"
> {
  subscribe(
    type: "change",
    listener: () => void
  ): () => void;
}

export interface EditorTargetsBrowser {
  prompt(
    options: PromptOptions
  ): Promise<string | null>;
  confirm(
    options: ConfirmOptions
  ): Promise<boolean>;
}

export interface EditorTargetsOptions {
  catalog: EditorTargetsCatalog;
  accepts: string;
  current: string;
  navigator: LaunchNavigator;
  /**
   * @default the DOM dialogs
   */
  browser?: EditorTargetsBrowser;
}

export class EditorTargets extends Emitter<EditorTargetsEvents> {
  readonly accepts: string;
  readonly current: string;

  readonly #catalog: EditorTargetsCatalog;
  readonly #navigator: LaunchNavigator;
  readonly #browser: EditorTargetsBrowser;
  readonly #unsubscribe: () => void;
  #accepted: AssetRecordData[] = [];
  #sorted: AssetRecordData[] = [];

  constructor(
    options: EditorTargetsOptions
  ) {
    super();

    this.accepts = options.accepts;
    this.current = options.current;
    this.#catalog = options.catalog;
    this.#navigator = options.navigator;
    this.#browser = options.browser ?? kDomTargetsBrowser;
    this.#refresh();
    this.#unsubscribe = this.#catalog.subscribe("change", () => {
      if (this.#refresh()) {
        this.emit("change");
      }
    });
  }

  [Symbol.iterator](): IterableIterator<AssetRecordData> {
    this.#refresh();

    return this.#sorted.values();
  }

  get canRemoveCurrent(): boolean {
    this.#refresh();

    return this.#sorted.length > 1;
  }

  async open(
    assetId: string
  ): Promise<void> {
    if (assetId !== this.current) {
      await this.#navigator.navigate(assetId, null);
    }
  }

  async renameCurrent(): Promise<void> {
    const record = this.#catalog.record(this.current);
    if (record === undefined) {
      return;
    }

    const path = new AssetPath(record.path);
    const name = (await this.#browser.prompt({
      title: "Rename asset",
      icon: "asset-rename",
      label: "Name",
      defaultValue: path.name,
      confirmLabel: "Rename"
    }))?.trim();
    if (name !== undefined && name !== "" && name !== path.name) {
      await this.#catalog.rename(this.current, path.withName(name).toString());
    }
  }

  async removeCurrent(): Promise<void> {
    const records = [...this];
    const index = records.findIndex((record) => record.id === this.current);
    if (index === -1) {
      return;
    }
    if (records.length === 1) {
      throw new LastTargetError(this.accepts);
    }

    const label = withoutExtension(records[index]);
    const dependents = this.#catalog.listDependents(this.current);
    if (dependents.length > 0) {
      throw new TargetInUseError(label, dependents.map(withoutExtension));
    }

    const confirmed = await this.#browser.confirm({
      title: "Delete asset",
      message: `Delete "${label}"?`,
      confirmLabel: "Delete",
      danger: true
    });
    if (confirmed) {
      const next = records[index + 1] ?? records[index - 1];
      await this.#navigator.navigate(next.id, null);
      await this.#catalog.remove(this.current);
    }
  }

  dispose(): void {
    this.#unsubscribe();
  }

  #refresh(): boolean {
    let count = 0;
    let unchanged = true;
    for (const record of this.#catalog.records()) {
      if (record.kind === this.accepts) {
        unchanged &&= this.#accepted[count] === record;
        count++;
      }
    }
    if (unchanged && count === this.#accepted.length) {
      return false;
    }

    this.#accepted = Array.from(this.#catalog.records())
      .filter((record) => record.kind === this.accepts);
    this.#sorted = this.#accepted
      .toSorted((left, right) => kPathOrder.compare(left.path, right.path));

    return true;
  }
}

function withoutExtension(
  record: AssetRecordData
): string {
  return new AssetPath(record.path).withoutExtension().toString();
}
