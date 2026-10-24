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

  constructor() {
    super();
    const early = Object.getOwnPropertyDescriptor(this, "editing");
    if (early !== undefined) {
      Reflect.deleteProperty(this, "editing");
      this.editing = early.value;
    }
  }

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
