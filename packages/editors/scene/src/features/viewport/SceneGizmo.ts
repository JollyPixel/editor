// Import Third-party Dependencies
import type * as THREE from "three";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type {
  SceneChange,
  SceneDocument,
  SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import {
  TransformControls,
  type TransformEndEvent
} from "@jolly-pixel/three";
import { EDITOR_GIZMO_APPEARANCE } from "@jolly-pixel/editor.host/viewport";

// Import Internal Dependencies
import type { SceneBinding } from "../../scene/SceneBinding.ts";
import { decomposePose } from "../../scene/sceneTransform.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";
import type {
  GizmoMode,
  GizmoSettings
} from "./GizmoSettings.ts";

// CONSTANTS
const kPatchFields: Readonly<Record<GizmoMode, keyof SceneTransformPatch>> = {
  translate: "position",
  rotate: "rotation",
  scale: "scale"
};

export interface SceneGizmoOptions {
  camera: OrbitFlyCamera;
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  binding: SceneBinding;
  document: SceneDocument;
  selection: SelectionStore;
  settings: GizmoSettings;
}

export class SceneGizmo {
  #options: SceneGizmoOptions;
  #controls: TransformControls;
  #dragged: string | null = null;

  #sync = (): void => {
    const { binding, selection, settings } = this.#options;
    const id = selection.primary;
    const actor = id === null ? null : binding.actor(id);

    this.#controls.mode = settings.mode;
    this.#controls.orientation = settings.space;
    if (actor === null) {
      this.#controls.detach();
    }
    else if (this.#controls.target !== actor.object3D) {
      this.#controls.attach(actor.object3D);
    }
  };

  #onDocumentChange = (
    change: SceneChange
  ): void => {
    if (
      this.#dragged !== null &&
      change.origin !== "local" &&
      touchesActor(change, this.#dragged)
    ) {
      this.#controls.cancel();
    }
    this.#sync();
  };

  #onStart = (): void => {
    this.#dragged = this.#options.selection.primary;
    this.#options.camera.enabled = false;
  };

  #onEnd = (
    event: TransformEndEvent
  ): void => {
    const id = this.#dragged;
    this.#dragged = null;
    this.#options.camera.enabled = true;
    if (id === null || !event.changed || event.cancelled) {
      return;
    }

    const field = kPatchFields[event.mode];
    const transform = decomposePose(event);
    const committed = this.#options.document.transform(id, {
      [field]: transform[field]
    });
    if (!committed) {
      this.#options.binding.restoreActor(id);
    }
  };

  constructor(
    options: SceneGizmoOptions
  ) {
    this.#options = options;
    this.#controls = new TransformControls(
      options.camera.camera,
      options.canvas,
      {
        appearance: {
          ...EDITOR_GIZMO_APPEARANCE,
          planes: false
        }
      }
    );
    options.scene.add(this.#controls.helper);

    this.#controls.addEventListener("start", this.#onStart);
    this.#controls.addEventListener("end", this.#onEnd);
    options.selection.on("change", this.#sync);
    options.settings.on("change", this.#sync);
    options.document.on("change", this.#onDocumentChange);
    options.document.on("reset", this.#sync);
    this.#sync();
  }

  get dragging(): boolean {
    return this.#controls.dragging;
  }

  get hovering(): boolean {
    return this.#controls.hoveredHandle !== null;
  }

  dispose(): void {
    const { selection, settings, document, scene } = this.#options;
    selection.off("change", this.#sync);
    settings.off("change", this.#sync);
    document.off("change", this.#onDocumentChange);
    document.off("reset", this.#sync);
    this.#controls.removeEventListener("start", this.#onStart);
    this.#controls.removeEventListener("end", this.#onEnd);
    scene.remove(this.#controls.helper);
    this.#controls.dispose();
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
