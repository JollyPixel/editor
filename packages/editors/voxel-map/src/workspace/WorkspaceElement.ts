// Import Third-party Dependencies
import { LitElement } from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "./VoxelMapWorkspace.ts";

export class WorkspaceElement extends LitElement {
  readonly #controller = new SubscriptionController<VoxelMapWorkspace>(
    this,
    (workspace) => this.watchWorkspace(workspace)
  );

  get workspace(): VoxelMapWorkspace | null {
    return this.#controller.current;
  }

  set workspace(
    workspace: VoxelMapWorkspace
  ) {
    if (workspace !== this.#controller.current) {
      this.#controller.attach(workspace);
    }
  }

  get attached(): VoxelMapWorkspace {
    return this.#controller.attached;
  }

  protected watchWorkspace(
    _workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    return [];
  }
}
