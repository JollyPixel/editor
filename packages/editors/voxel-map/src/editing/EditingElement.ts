// Import Third-party Dependencies
import { LitElement } from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapEditing } from "./VoxelMapEditing.ts";

export class EditingElement extends LitElement {
  readonly #controller = new SubscriptionController<VoxelMapEditing>(
    this,
    (editing) => this.watchEditing(editing)
  );

  get editing(): VoxelMapEditing | null {
    return this.#controller.current;
  }

  set editing(
    editing: VoxelMapEditing
  ) {
    if (editing !== this.#controller.current) {
      this.#controller.attach(editing);
    }
  }

  get attached(): VoxelMapEditing {
    return this.#controller.attached;
  }

  protected watchEditing(
    _editing: VoxelMapEditing
  ): Iterable<() => void> {
    return [];
  }
}
