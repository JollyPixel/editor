// Import Third-party Dependencies
import type { SceneDocument } from "@jolly-pixel/asset.scene/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { SceneLiveView } from "../editing/SceneEditing.ts";

export type ExpandedActors = Pick<
  SceneLiveView,
  "expandedActor" | "componentEntry" | "subscribe"
>;

export type SelectionStoreEvents = {
  change: (ids: readonly string[]) => void;
};

export interface ComponentFocus {
  readonly ownerId: string;
  readonly componentId: string;
}

export class SelectionStore extends Emitter<SelectionStoreEvents> {
  #ids: readonly string[] = [];
  #focused: ComponentFocus | null = null;
  #unsubscribe: (() => void)[];

  constructor(
    document: SceneDocument,
    expanded: ExpandedActors
  ) {
    super();
    const prune = (): void => {
      const focused = this.#focused;
      const ids = this.#ids.filter(
        (id) => document.tree.has(id) || expanded.expandedActor(id) !== null
      );
      const kept = focused !== null && ids.includes(focused.ownerId) && (
        document.tree.component(focused.componentId) !== undefined ||
        expanded.componentEntry(focused.componentId) !== null
      );
      this.#update(ids, kept ? focused : null);
    };
    this.#unsubscribe = [
      document.subscribe("change", prune),
      document.subscribe("reset", prune),
      expanded.subscribe("actorsChange", prune)
    ];
  }

  get ids(): readonly string[] {
    return this.#ids;
  }

  get primary(): string | null {
    return this.#ids[0] ?? null;
  }

  get focused(): ComponentFocus | null {
    return this.#focused;
  }

  has(
    id: string
  ): boolean {
    return this.#ids.includes(id);
  }

  select(
    ids: Iterable<string>
  ): void {
    this.#update([...new Set(ids)], null);
  }

  focus(
    focus: ComponentFocus
  ): void {
    this.#update([focus.ownerId], {
      ownerId: focus.ownerId,
      componentId: focus.componentId
    });
  }

  toggle(
    id: string
  ): void {
    this.select(this.has(id) ?
      this.#ids.filter((selected) => selected !== id) :
      [id, ...this.#ids]);
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
  }

  #update(
    ids: readonly string[],
    focused: ComponentFocus | null
  ): void {
    if (
      focused?.componentId === this.#focused?.componentId &&
      ids.length === this.#ids.length &&
      ids.every((id, index) => id === this.#ids[index])
    ) {
      return;
    }

    this.#ids = ids;
    this.#focused = focused;
    this.emit("change", ids);
  }
}
