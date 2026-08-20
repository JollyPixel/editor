export interface ProjectedEntry {
  readonly id: string;
  readonly path: string;
  readonly kind: string;
  readonly hash: string;
}

export interface ObservedEntry {
  readonly path: string;
  readonly hash: string;
}

export interface RenamedAsset {
  readonly id: string;
  readonly kind: string;
  readonly from: string;
  readonly to: string;
  readonly hash: string;
}

export interface UpdatedAsset {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
  readonly hash: string;
}

export interface CreatedAsset {
  readonly path: string;
  readonly hash: string;
}

export interface DeletedAsset {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
}

export interface RenameMatch {
  readonly renamed: RenamedAsset[];
  readonly updated: UpdatedAsset[];
  readonly created: CreatedAsset[];
  readonly deleted: DeletedAsset[];
}

/**
 * Matches a rename only when one removed and one added path share a hash.
 *
 * Ambiguous hashes remain deletes and creates.
 */
export function matchRenames(
  projected: Iterable<ProjectedEntry>,
  observed: Iterable<ObservedEntry>
): RenameMatch {
  const previous = new Map<string, ProjectedEntry>();
  for (const entry of projected) {
    previous.set(entry.path, entry);
  }

  const current = new Map<string, ObservedEntry>();
  for (const entry of observed) {
    current.set(entry.path, entry);
  }

  const updated: UpdatedAsset[] = [];
  const appeared: ObservedEntry[] = [];
  const disappeared: ProjectedEntry[] = [];

  for (const [path, entry] of current) {
    const before = previous.get(path);
    if (before === undefined) {
      appeared.push(entry);
    }
    else if (before.hash !== entry.hash) {
      updated.push({
        id: before.id,
        kind: before.kind,
        path,
        hash: entry.hash
      });
    }
  }

  for (const [path, entry] of previous) {
    if (!current.has(path)) {
      disappeared.push(entry);
    }
  }

  const appearedByHash = Map.groupBy(appeared, (entry) => entry.hash);
  const disappearedByHash = Map.groupBy(disappeared, (entry) => entry.hash);

  const renamed: RenamedAsset[] = [];
  const created: CreatedAsset[] = [];
  const deleted: DeletedAsset[] = [];

  for (const [hash, candidates] of appearedByHash) {
    const sources = disappearedByHash.get(hash) ?? [];
    const source = singleton(sources);
    const target = singleton(candidates);
    if (source !== undefined && target !== undefined) {
      renamed.push({
        id: source.id,
        kind: source.kind,
        from: source.path,
        to: target.path,
        hash
      });
      disappearedByHash.delete(hash);
      continue;
    }

    for (const candidate of candidates) {
      created.push({
        path: candidate.path,
        hash: candidate.hash
      });
    }
  }

  for (const sources of disappearedByHash.values()) {
    for (const source of sources) {
      deleted.push({
        id: source.id,
        kind: source.kind,
        path: source.path
      });
    }
  }

  return {
    renamed: sortBy(renamed, (entry) => entry.to),
    updated: sortBy(updated, (entry) => entry.path),
    created: sortBy(created, (entry) => entry.path),
    deleted: sortBy(deleted, (entry) => entry.path)
  };
}

/**
 * The lone member of `values`, or `undefined` when it holds anything else.
 */
function singleton<TValue>(
  values: readonly TValue[]
): TValue | undefined {
  return values.length === 1 ? values.at(0) : undefined;
}

function sortBy<TValue>(
  values: TValue[],
  key: (value: TValue) => string
): TValue[] {
  return values.sort((a, b) => key(a).localeCompare(key(b)));
}
