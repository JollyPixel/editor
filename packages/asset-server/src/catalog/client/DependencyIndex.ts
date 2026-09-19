// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

export type DependencyMap = Readonly<
  Record<string, readonly AssetReferenceData[]>
>;

export class DependencyIndex {
  #outgoing = new Map<string, readonly AssetReferenceData[]>();
  #incoming = new Map<string, Set<string>>();

  set(
    assetId: string,
    dependencies: readonly AssetReferenceData[]
  ): boolean {
    const previous = this.#outgoing.get(assetId);
    if (previous !== undefined && sameReferences(previous, dependencies)) {
      return false;
    }

    this.#unlink(assetId);
    this.#outgoing.set(assetId, dependencies.map(copyReference));
    for (const { id } of dependencies) {
      let dependents = this.#incoming.get(id);
      if (dependents === undefined) {
        dependents = new Set();
        this.#incoming.set(id, dependents);
      }
      dependents.add(assetId);
    }

    return true;
  }

  delete(
    assetId: string
  ): boolean {
    const known = this.#outgoing.has(assetId);
    this.#unlink(assetId);

    return known;
  }

  has(
    assetId: string
  ): boolean {
    return this.#outgoing.has(assetId);
  }

  clear(): void {
    this.#outgoing.clear();
    this.#incoming.clear();
  }

  dependenciesOf(
    assetId: string
  ): readonly AssetReferenceData[] {
    return this.#outgoing.get(assetId)?.map(copyReference) ?? [];
  }

  dependentsOf(
    assetId: string
  ): readonly string[] {
    return [...this.#incoming.get(assetId) ?? []];
  }

  closureOf(
    assetId: string
  ): AssetReferenceData[] {
    const visited = new Set([assetId]);
    const closure: AssetReferenceData[] = [];
    const queue = [assetId];

    for (let index = 0; index < queue.length; index++) {
      for (const reference of this.#outgoing.get(queue[index]) ?? []) {
        if (!visited.has(reference.id)) {
          visited.add(reference.id);
          closure.push(copyReference(reference));
          queue.push(reference.id);
        }
      }
    }

    return closure;
  }

  toJSON(): DependencyMap {
    return Object.fromEntries(
      Array.from(
        this.#outgoing,
        ([assetId, references]) => [assetId, references.map(copyReference)]
      )
    );
  }

  #unlink(
    assetId: string
  ): void {
    for (const { id } of this.#outgoing.get(assetId) ?? []) {
      const dependents = this.#incoming.get(id);
      dependents?.delete(assetId);
      if (dependents?.size === 0) {
        this.#incoming.delete(id);
      }
    }
    this.#outgoing.delete(assetId);
  }
}

function copyReference(
  reference: AssetReferenceData
): AssetReferenceData {
  return {
    id: reference.id,
    kind: reference.kind
  };
}

function sameReferences(
  left: readonly AssetReferenceData[],
  right: readonly AssetReferenceData[]
): boolean {
  return left.length === right.length && left.every(
    (reference, index) => reference.id === right[index].id &&
      reference.kind === right[index].kind
  );
}
