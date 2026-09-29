// Import Third-party Dependencies
import { LitElement } from "lit";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "./VoxelMapWorkspace.ts";
import { WorkspaceController } from "./WorkspaceController.ts";

export class WorkspaceElement extends LitElement {
  readonly #controller = new WorkspaceController(
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
