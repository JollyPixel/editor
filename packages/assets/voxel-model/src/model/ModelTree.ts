// Import Internal Dependencies
import type {
  BlockNodeJSON,
  BlockTransformJSON,
  ModelNodeJSON,
  VoxelModelCommand
} from "../network/types.ts";

export type ModelTreeReader = Pick<
  ModelTree,
  | "size"
  | "has"
  | "get"
  | "block"
  | "values"
  | "blocks"
  | "childrenOf"
  | "subtreeOf"
  | "enclosingBlockOf"
  | "transformParentOf"
  | "accepts"
>;

export class ModelTree {
  #nodes = new Map<string, ModelNodeJSON>();

  get size(): number {
    return this.#nodes.size;
  }

  has(
    id: string
  ): boolean {
    return this.#nodes.has(id);
  }

  get(
    id: string
  ): ModelNodeJSON | undefined {
    const node = this.#nodes.get(id);

    return node === undefined ? undefined : structuredClone(node);
  }

  block(
    id: string
  ): BlockNodeJSON | undefined {
    const node = this.#nodes.get(id);

    return node?.kind === "block" ? structuredClone(node) : undefined;
  }

  * values(): IterableIterator<ModelNodeJSON> {
    for (const node of this.#nodes.values()) {
      yield structuredClone(node);
    }
  }

  * blocks(): IterableIterator<BlockNodeJSON> {
    for (const node of this.#nodes.values()) {
      if (node.kind === "block") {
        yield structuredClone(node);
      }
    }
  }

  childrenOf(
    parentId: string | null
  ): ModelNodeJSON[] {
    return [...this.#nodes.values()]
      .filter((node) => node.parentId === parentId)
      .map((node) => structuredClone(node));
  }

  subtreeOf(
    id: string
  ): ModelNodeJSON[] {
    const root = this.#nodes.get(id);
    if (root === undefined) {
      return [];
    }

    const byParent = Map.groupBy(
      this.#nodes.values(),
      (node) => node.parentId
    );
    const subtree: ModelNodeJSON[] = [];
    const visited = new Set<string>();
    const queue = [root];
    for (const node of queue) {
      if (visited.has(node.id)) {
        continue;
      }
      visited.add(node.id);
      subtree.push(structuredClone(node));
      queue.push(...byParent.get(node.id) ?? []);
    }

    return subtree;
  }

  enclosingBlockOf(
    id: string | null
  ): string | null {
    let current = id;
    for (let step = 0; current !== null && step <= this.#nodes.size; step++) {
      const node = this.#nodes.get(current);
      if (node === undefined) {
        return null;
      }
      if (node.kind === "block") {
        return node.id;
      }
      current = node.parentId;
    }

    return null;
  }

  transformParentOf(
    id: string
  ): string | null {
    return this.enclosingBlockOf(
      this.#nodes.get(id)?.parentId ?? null
    );
  }

  accepts(
    command: VoxelModelCommand
  ): boolean {
    switch (command.action) {
      case "node-added":
        return !this.#nodes.has(command.node.id) &&
          this.#isParent(command.node.parentId);
      case "node-removed":
      case "node-renamed":
        return this.#nodes.has(command.id);
      case "node-moved":
        return this.#nodes.has(command.id) &&
          this.#isParent(command.parentId) &&
          !this.#isWithin(command.parentId, command.id) &&
          command.transforms.every(({ id }) => this.#isBlock(id));
      case "node-transformed":
        return this.#isBlock(command.id);
    }
  }

  apply(
    command: VoxelModelCommand
  ): void {
    switch (command.action) {
      case "node-added":
        this.#nodes.set(command.node.id, structuredClone(command.node));
        break;

      case "node-removed":
        for (const node of this.subtreeOf(command.id)) {
          this.#nodes.delete(node.id);
        }
        break;

      case "node-renamed":
        this.#patch(command.id, { name: command.name });
        break;

      case "node-moved":
        this.#patch(command.id, { parentId: command.parentId });
        for (const { id, transform } of command.transforms) {
          this.#transform(id, transform);
        }
        break;

      case "node-transformed":
        this.#transform(command.id, command.transform);
        if (command.flipAxes) {
          this.#patchBlock(command.id, { flipAxes: { ...command.flipAxes } });
        }
        break;
    }
  }

  load(
    nodes: Iterable<ModelNodeJSON>
  ): void {
    this.#nodes.clear();
    for (const node of nodes) {
      this.#nodes.set(node.id, structuredClone(node));
    }
  }

  clear(): void {
    this.#nodes.clear();
  }

  toJSON(): ModelNodeJSON[] {
    return [...this.values()];
  }

  #isParent(
    id: string | null
  ): boolean {
    return id === null || this.#nodes.has(id);
  }

  #isBlock(
    id: string
  ): boolean {
    return this.#nodes.get(id)?.kind === "block";
  }

  #isWithin(
    id: string | null,
    ancestorId: string
  ): boolean {
    let current = id;
    for (let step = 0; current !== null && step <= this.#nodes.size; step++) {
      if (current === ancestorId) {
        return true;
      }
      current = this.#nodes.get(current)?.parentId ?? null;
    }

    return false;
  }

  #patch(
    id: string,
    patch: { name?: string; parentId?: string | null; }
  ): void {
    const node = this.#nodes.get(id);
    if (node) {
      this.#nodes.set(id, { ...node, ...patch });
    }
  }

  #patchBlock(
    id: string,
    patch: Partial<Pick<BlockNodeJSON, "transform" | "flipAxes">>
  ): void {
    const node = this.#nodes.get(id);
    if (node?.kind === "block") {
      this.#nodes.set(id, { ...node, ...patch });
    }
  }

  #transform(
    id: string,
    transform: BlockTransformJSON
  ): void {
    this.#patchBlock(id, { transform: structuredClone(transform) });
  }
}
