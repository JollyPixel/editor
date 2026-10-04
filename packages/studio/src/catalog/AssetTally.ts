// Import Third-party Dependencies
import type { IconName } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetKindSet } from "./AssetKindSet.ts";

export interface AssetTallyRow {
  readonly kind: string;
  readonly label: string;
  readonly icon: IconName;
  readonly count: number;
}

export interface TalliedRecord {
  readonly kind: string;
}

export class AssetTally {
  static readonly EMPTY = new AssetTally([]);

  readonly rows: readonly AssetTallyRow[];
  readonly total: number;

  static count(
    records: Iterable<TalliedRecord>,
    kinds: AssetKindSet
  ): AssetTally {
    const counts = new Map<string, number>(
      kinds.entries.map((entry) => [entry.kind, 0])
    );
    for (const { kind } of records) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }

    const unknown = [...counts.keys()]
      .filter((kind) => !kinds.has(kind))
      .sort();

    return new AssetTally(
      [...kinds.entries.map((entry) => entry.kind), ...unknown].map(
        (kind) => {
          return {
            kind,
            label: kinds.entryOf(kind)?.label ?? kind,
            icon: kinds.iconFor(kind),
            count: counts.get(kind) ?? 0
          };
        }
      )
    );
  }

  constructor(
    rows: Iterable<AssetTallyRow>
  ) {
    this.rows = Object.freeze(
      Array.from(
        rows,
        (row) => Object.freeze({ ...row })
      )
    );
    this.total = this.rows.reduce(
      (sum, row) => sum + row.count,
      0
    );
  }

  equals(
    other: AssetTally
  ): boolean {
    return this.rows.length === other.rows.length && this.rows.every(
      (row, index) => sameRow(row, other.rows[index])
    );
  }
}

function sameRow(
  left: AssetTallyRow,
  right: AssetTallyRow
): boolean {
  return left.kind === right.kind &&
    left.label === right.label &&
    left.icon === right.icon &&
    left.count === right.count;
}
