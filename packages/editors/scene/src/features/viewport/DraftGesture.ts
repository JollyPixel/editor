// Import Third-party Dependencies
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type {
  SceneChange,
  SceneDocument,
  SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { SceneDraft } from "../../state/SceneDraft.ts";

export interface DraftGestureOptions {
  camera: Pick<OrbitFlyCamera, "enabled">;
  document: Pick<SceneDocument, "on" | "off">;
  draft: Pick<
    SceneDraft,
    "editTransform" | "commitTransform" | "discardTransform"
  >;
  onInterrupt: () => void;
}

export class DraftGesture {
  #options: DraftGestureOptions;
  #id: string | null = null;
  #patch: SceneTransformPatch | null = null;

  #onDocumentChange = (
    change: SceneChange
  ): void => {
    if (
      this.#id !== null &&
      change.origin !== "local" &&
      touchesActor(change, this.#id)
    ) {
      this.#options.onInterrupt();
    }
  };

  #onReset = (): void => {
    if (this.#id !== null) {
      this.#options.onInterrupt();
    }
  };

  constructor(
    options: DraftGestureOptions
  ) {
    this.#options = options;
    options.document.on("change", this.#onDocumentChange);
    options.document.on("reset", this.#onReset);
  }

  get active(): boolean {
    return this.#id !== null;
  }

  begin(
    id: string
  ): void {
    this.#id = id;
    this.#patch = null;
    this.#options.camera.enabled = false;
  }

  edit(
    patch: SceneTransformPatch
  ): void {
    if (this.#id !== null) {
      this.#patch = patch;
      this.#options.draft.editTransform(this.#id, patch);
    }
  }

  end(): void {
    const patch = this.#patch;
    const id = this.#release();
    if (id === null) {
      return;
    }

    if (patch === null) {
      this.#options.draft.discardTransform(id);
    }
    else {
      this.#options.draft.commitTransform(id, patch);
    }
  }

  cancel(): void {
    const id = this.#release();
    if (id !== null) {
      this.#options.draft.discardTransform(id);
    }
  }

  dispose(): void {
    this.#options.document.off("change", this.#onDocumentChange);
    this.#options.document.off("reset", this.#onReset);
  }

  #release(): string | null {
    const id = this.#id;
    this.#id = null;
    this.#patch = null;
    if (id !== null) {
      this.#options.camera.enabled = true;
    }

    return id;
  }
}

function touchesActor(
  change: SceneChange,
  id: string
): boolean {
  const { command } = change;
  switch (command.action) {
    case "actor-transformed":
    case "actor-moved":
    case "actor-removed":
      return command.id === id;
    default:
      return false;
  }
}
