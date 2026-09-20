// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../scene/EditorScene.ts";

export type WorkspaceSubscriber = (
  workspace: VoxelMapWorkspace
) => Iterable<() => void>;

export class WorkspaceController implements ReactiveController {
  #host: ReactiveControllerHost;
  #subscribe: WorkspaceSubscriber;
  #workspace: VoxelMapWorkspace | null = null;
  #connected = false;
  #subscriptions: Array<() => void> = [];

  get current(): VoxelMapWorkspace | null {
    return this.#workspace;
  }

  get attached(): VoxelMapWorkspace {
    if (this.#workspace === null) {
      throw new Error("No workspace is attached yet.");
    }

    return this.#workspace;
  }

  constructor(
    host: ReactiveControllerHost,
    subscribe: WorkspaceSubscriber = () => []
  ) {
    this.#host = host;
    this.#subscribe = subscribe;
    host.addController(this);
  }

  attach(
    workspace: VoxelMapWorkspace
  ): void {
    this.#workspace = workspace;
    this.#resubscribe();
    this.#host.requestUpdate();
  }

  hostConnected(): void {
    this.#connected = true;
    this.#resubscribe();
  }

  hostDisconnected(): void {
    this.#connected = false;
    this.#release();
  }

  #resubscribe(): void {
    this.#release();
    if (this.#connected && this.#workspace !== null) {
      this.#subscriptions.push(...this.#subscribe(this.#workspace));
    }
  }

  #release(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }
}
