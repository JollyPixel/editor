export interface LaidOutRecord {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
}

interface Placement {
  readonly kind: string;
  readonly path: string;
}

export class CatalogLayout {
  static readonly EMPTY = new CatalogLayout([], []);

  #records: ReadonlyMap<string, Placement>;
  #folders: ReadonlySet<string>;

  constructor(
    records: Iterable<LaidOutRecord>,
    folders: Iterable<string>
  ) {
    this.#records = new Map(
      Array.from(
        records,
        ({ id, kind, path }) => [id, { kind, path }]
      )
    );
    this.#folders = new Set(folders);
  }

  matches(
    records: Iterable<LaidOutRecord>,
    folders: Iterable<string>
  ): boolean {
    let recordCount = 0;
    for (const { id, kind, path } of records) {
      const placement = this.#records.get(id);
      if (placement?.kind !== kind || placement.path !== path) {
        return false;
      }
      recordCount++;
    }

    const seenFolders = new Set<string>();
    for (const folder of folders) {
      if (!this.#folders.has(folder)) {
        return false;
      }
      seenFolders.add(folder);
    }

    return recordCount === this.#records.size &&
      seenFolders.size === this.#folders.size;
  }
}
