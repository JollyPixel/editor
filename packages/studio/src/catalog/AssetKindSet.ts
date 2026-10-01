// Import Third-party Dependencies
import type {
  IconName,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetKindPresenter } from "./AssetTreeModel.ts";

// CONSTANTS
const kFallbackIcon: IconName = "file";
const kNoEditorDetail = "no editor";
const kNewAssetPrefix = "New ";

export interface AssetKindEntry {
  readonly kind: string;
  readonly label: string;
  readonly extension: string;
  readonly icon?: IconName;
}

export interface AssetKindSetInit {
  kinds: Iterable<AssetKindEntry>;
  editable: Iterable<string>;
}

export class AssetKindSet implements AssetKindPresenter {
  static readonly EMPTY = new AssetKindSet({
    kinds: [],
    editable: []
  });

  readonly entries: readonly AssetKindEntry[];

  #byKind: ReadonlyMap<string, AssetKindEntry>;
  #editable: ReadonlySet<string>;

  constructor(
    init: AssetKindSetInit
  ) {
    this.entries = Object.freeze(
      Array.from(
        init.kinds,
        (entry) => Object.freeze({ ...entry })
      )
    );
    this.#byKind = new Map(
      this.entries.map((entry) => [entry.kind, entry])
    );
    this.#editable = new Set(
      init.editable
    );
  }

  has(
    kind: string
  ): boolean {
    return this.#byKind.has(kind);
  }

  entryOf(
    kind: string
  ): AssetKindEntry | undefined {
    return this.#byKind.get(kind);
  }

  iconFor(
    kind: string
  ): IconName {
    return this.#byKind.get(
      kind
    )?.icon ?? kFallbackIcon;
  }

  detailFor(
    kind: string
  ): string | undefined {
    return this.#editable.has(kind)
      ? undefined
      : kNoEditorDetail;
  }

  displayNameFor(
    kind: string,
    name: string
  ): string {
    const extension = this.#byKind.get(kind)?.extension ?? "";
    if (
      extension === "" ||
      name === extension ||
      !name.endsWith(extension)
    ) {
      return name;
    }

    return name.slice(0, -extension.length);
  }

  toOptions(): JollyOption<string>[] {
    return this.entries.map(({ kind, label }) => {
      return {
        value: kind,
        label,
        icon: this.iconFor(kind)
      };
    });
  }
}

export function newAssetName(
  entry: AssetKindEntry
): string {
  const { label } = entry;

  return `${kNewAssetPrefix}${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}
