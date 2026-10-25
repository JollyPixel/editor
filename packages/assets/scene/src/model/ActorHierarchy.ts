// Import Internal Dependencies
import type { SceneActorJSON } from "../network/types.ts";
import {
  findNextId,
  slotIndex
} from "./siblingSlots.ts";

export class ActorHierarchy {
  #actors = new Map<string, SceneActorJSON>();
  #children = new Map<string | null, string[]>();

  get size(): number {
    return this.#actors.size;
  }

  has(
    id: string
  ): boolean {
    return this.#actors.has(id);
  }

  peek(
    id: string
  ): Readonly<SceneActorJSON> | undefined {
    return this.#actors.get(id);
  }

  * walk(
    parentId: string | null
  ): IterableIterator<Readonly<SceneActorJSON>> {
    for (const id of this.#children.get(parentId) ?? []) {
      const actor = this.#actors.get(id);
      if (actor !== undefined) {
        yield actor;
        yield* this.walk(id);
      }
    }
  }

  subtreeFrom(
    id: string
  ): Readonly<SceneActorJSON>[] {
    const root = this.#actors.get(id);

    return root === undefined ? [] : [root, ...this.walk(id)];
  }

  findNextSibling(
    id: string
  ): string | undefined {
    const actor = this.#actors.get(id);
    if (actor === undefined) {
      return undefined;
    }

    return findNextId(this.#children.get(actor.parentId) ?? [], id);
  }

  isParent(
    id: string | null
  ): boolean {
    return id === null || this.#actors.has(id);
  }

  isWithin(
    id: string | null,
    ancestorId: string
  ): boolean {
    let current = id;
    for (let step = 0; current !== null && step <= this.#actors.size; step++) {
      if (current === ancestorId) {
        return true;
      }
      current = this.#actors.get(current)?.parentId ?? null;
    }

    return false;
  }

  isSiblingSlot(
    beforeId: string | undefined,
    parentId: string | null,
    id: string
  ): boolean {
    return beforeId === undefined || (
      beforeId !== id &&
      this.#actors.get(beforeId)?.parentId === parentId
    );
  }

  insert(
    actor: SceneActorJSON,
    beforeId: string | undefined
  ): void {
    this.#actors.set(actor.id, structuredClone(actor));
    this.#place(actor.id, actor.parentId, beforeId);
  }

  move(
    id: string,
    parentId: string | null,
    beforeId: string | undefined
  ): void {
    const actor = this.#actors.get(id);
    if (actor === undefined) {
      return;
    }

    this.#detach(actor);
    this.#actors.set(id, {
      ...actor,
      parentId
    });
    this.#place(id, parentId, beforeId);
  }

  update(
    id: string,
    change: (actor: SceneActorJSON) => SceneActorJSON
  ): void {
    const actor = this.#actors.get(id);
    if (actor !== undefined) {
      this.#actors.set(id, change(actor));
    }
  }

  remove(
    id: string
  ): Readonly<SceneActorJSON>[] {
    const removed = this.subtreeFrom(id);
    const [root] = removed;
    if (root !== undefined) {
      this.#detach(root);
    }
    for (const actor of removed) {
      this.#children.delete(actor.id);
      this.#actors.delete(actor.id);
    }

    return removed;
  }

  clear(): void {
    this.#actors.clear();
    this.#children.clear();
  }

  #place(
    id: string,
    parentId: string | null,
    beforeId: string | undefined
  ): void {
    let siblings = this.#children.get(parentId);
    if (siblings === undefined) {
      siblings = [];
      this.#children.set(parentId, siblings);
    }
    siblings.splice(slotIndex(siblings, beforeId), 0, id);
  }

  #detach(
    actor: Readonly<SceneActorJSON>
  ): void {
    const siblings = this.#children.get(actor.parentId) ?? [];
    const index = siblings.indexOf(actor.id);
    if (index !== -1) {
      siblings.splice(index, 1);
    }
  }
}
