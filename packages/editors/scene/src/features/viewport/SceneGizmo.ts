// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";
import type * as THREE from "three";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type {
  SceneChange,
  SceneDocument,
  SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import {
  COMPACT_GIZMO_APPEARANCE,
  type TransformChangeEvent,
  TransformControls,
  type TransformEndEvent,
  type TransformGestureEvent
} from "@jolly-pixel/three";

// Import Internal Dependencies
import type { SceneComponents } from "../../components/SceneComponents.ts";
import { SCENE_PREFERENCES } from "../../preferences.ts";
import type { SceneBinding } from "../../scene/SceneBinding.ts";
import { decomposePose } from "../../scene/sceneTransform.ts";
import type { SceneDraft } from "../../state/SceneDraft.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";
import { gizmoSnap } from "./gizmoSnap.ts";
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
  document: Pick<SceneDocument, "on" | "off">;
  draft: Pick<
    SceneDraft,
    "editTransform" | "commitTransform" | "discardTransform"
  >;
  selection: SelectionStore;
  settings: GizmoSettings;
  preferences: Pick<Preferences, "values" | "watch">;
  components: Pick<SceneComponents, "actorOrigin">;
}

export class SceneGizmo {
  #options: SceneGizmoOptions;
  #controls: TransformControls;
  #dragged: string | null = null;
  #stopSnap: () => void;

  #applySnap = (): void => {
    const {
      binding,
      selection,
      preferences,
      components
    } = this.#options;
    const id = selection.primary;
    const entry = id === null ? null : binding.actorEntry(id);
    const origin = entry === null ?
      "center" :
      components.actorOrigin(entry.components.map(({ type }) => type));

    this.#controls.snap = gizmoSnap(
      preferences.values(SCENE_PREFERENCES),
      origin
    );
  };

  #sync = (): void => {
    const { binding, selection, settings } = this.#options;
    const id = selection.primary;
    const actor = id === null ? null : binding.actor(id);

    this.#applySnap();
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

  #onChange = (
    event: TransformChangeEvent
  ): void => {
    if (this.#dragged !== null) {
      this.#options.draft.editTransform(this.#dragged, posePatch(event));
    }
  };

  #onEnd = (
    event: TransformEndEvent
  ): void => {
    const id = this.#dragged;
    this.#dragged = null;
    this.#options.camera.enabled = true;
    if (id === null) {
      return;
    }

    if (event.changed && !event.cancelled) {
      this.#options.draft.commitTransform(id, posePatch(event));
    }
    else {
      this.#options.draft.discardTransform(id);
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
          ...COMPACT_GIZMO_APPEARANCE,
          planes: false
        }
      }
    );
    options.scene.add(this.#controls.helper);
    this.#stopSnap = options.preferences.watch(
      SCENE_PREFERENCES,
      this.#applySnap
    );

    this.#controls.addEventListener("start", this.#onStart);
    this.#controls.addEventListener("change", this.#onChange);
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
    this.#stopSnap();
    this.#controls.removeEventListener("start", this.#onStart);
    this.#controls.removeEventListener("change", this.#onChange);
    this.#controls.removeEventListener("end", this.#onEnd);
    scene.remove(this.#controls.helper);
    this.#controls.dispose();
  }
}

function posePatch(
  event: TransformGestureEvent
): SceneTransformPatch {
  const field = kPatchFields[event.mode];

  return {
    [field]: decomposePose(event)[field]
  };
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
