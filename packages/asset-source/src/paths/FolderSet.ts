export class FolderSet implements Iterable<string> {
  #paths = new Set<string>();

  constructor(
    folders: Iterable<string> = []
  ) {
    for (const folder of folders) {
      this.add(folder);
    }
  }

  get size(): number {
    return this.#paths.size;
  }

  has(
    folder: string
  ): boolean {
    return this.#paths.has(folder);
  }

  add(
    folder: string
  ): this {
    this.addParentsOf(folder);
    this.#paths.add(folder);

    return this;
  }

  addParentsOf(
    assetPath: string
  ): this {
    const segments = assetPath.split("/").slice(0, -1);
    for (let index = 1; index <= segments.length; index++) {
      this.#paths.add(segments.slice(0, index).join("/"));
    }

    return this;
  }

  subtree(
    root: string
  ): string[] {
    return this.toJSON().filter((folder) => isWithinFolder(folder, root));
  }

  prune(
    root: string,
    files: Iterable<string>
  ): string[] {
    const held = new FolderSet();
    for (const file of files) {
      held.addParentsOf(file);
    }

    const pruned = this.subtree(root).filter((folder) => !held.has(folder));
    for (const folder of pruned) {
      this.#paths.delete(folder);
    }

    return pruned;
  }

  equals(
    other: FolderSet
  ): boolean {
    return this.size === other.size &&
      [...this].every((folder) => other.has(folder));
  }

  toJSON(): string[] {
    return [...this.#paths].sort();
  }

  [Symbol.iterator](): IterableIterator<string> {
    return this.#paths.values();
  }
}

export function isWithinFolder(
  path: string,
  folder: string
): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}
