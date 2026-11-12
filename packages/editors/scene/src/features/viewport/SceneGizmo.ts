// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";
import type * as THREE from "three";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import type {
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
import { DraftGesture } from "./DraftGesture.ts";
import { actorSnap } from "./gizmoSnap.ts";
import type {
  GizmoMode,
  GizmoSettings
} from "./GizmoSettings.ts";

// CONSTANTS
const kIdleOpacity = 0.55;
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
  #gesture: DraftGesture;
  #stopPreferences: () => void;
  #resize: ResizeObserver;

  #applySnap = (): void => {
    this.#controls.snap = actorSnap(
      this.#options,
      this.#options.selection.primary
    );
  };

  #applySize = (): void => {
    const { canvas, preferences } = this.#options;
    if (canvas.clientHeight > 0) {
      this.#controls.size = preferences.values(SCENE_PREFERENCES).gizmoSize /
        canvas.clientHeight;
    }
  };

  #applyPreferences = (): void => {
    this.#applySnap();
    this.#applySize();
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
    else if (this.#controls.target !== actor.node.object3D) {
      this.#controls.attach(actor.node.object3D);
    }
  };

  #onStart = (): void => {
    const id = this.#options.selection.primary;
    if (id !== null) {
      this.#gesture.begin(id);
    }
  };

  #onChange = (
    event: TransformChangeEvent
  ): void => {
    this.#gesture.edit(posePatch(event));
  };

  #onEnd = (
    event: TransformEndEvent
  ): void => {
    if (event.cancelled) {
      this.#gesture.cancel();
    }
    else {
      this.#gesture.end();
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
          planes: false,
          viewRing: false,
          idleOpacity: kIdleOpacity,
          hideInactive: true
        }
      }
    );
    this.#gesture = new DraftGesture({
      camera: options.camera,
      document: options.document,
      draft: options.draft,
      onInterrupt: () => this.#controls.cancel()
    });
    options.scene.add(this.#controls.helper);
    this.#stopPreferences = options.preferences.watch(
      SCENE_PREFERENCES,
      this.#applyPreferences
    );
    this.#resize = new ResizeObserver(this.#applySize);
    this.#resize.observe(options.canvas);

    this.#controls.addEventListener("start", this.#onStart);
    this.#controls.addEventListener("change", this.#onChange);
    this.#controls.addEventListener("end", this.#onEnd);
    options.selection.on("change", this.#sync);
    options.settings.on("change", this.#sync);
    options.document.on("change", this.#sync);
    options.document.on("reset", this.#sync);
    this.#applySize();
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
    document.off("change", this.#sync);
    document.off("reset", this.#sync);
    this.#gesture.dispose();
    this.#stopPreferences();
    this.#resize.disconnect();
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
