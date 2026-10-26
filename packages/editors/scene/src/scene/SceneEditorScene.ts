// Import Third-party Dependencies
import {
  OrbitFlyCamera,
  Systems
} from "@jolly-pixel/engine";
import type { KeyBindingSettings } from "@jolly-pixel/controls";
import type {
  SceneDocument,
  SceneRoom
} from "@jolly-pixel/asset.scene/client";
import {
  followCameraPreferences,
  Teardown
} from "@jolly-pixel/editor.host";
import type { Preferences } from "@jolly-pixel/editor.host/preferences";
import { Grid } from "@jolly-pixel/three";

// Import Internal Dependencies
import { SceneBinding } from "./SceneBinding.ts";
import {
  EditAssets,
  type MapViewerOpener
} from "./EditAssets.ts";
import { createSceneDefinitions } from "../components/sceneComponents.ts";
import { SceneCollaboration } from "../collaboration/SceneCollaboration.ts";
import { SceneActions } from "../editing/SceneActions.ts";
import type {
  SceneAssetSlots,
  SceneEditing
} from "../editing/SceneEditing.ts";
import { createSceneHistory } from "../features/history/sceneHistory.ts";
import { ActorPicker } from "../features/viewport/ActorPicker.ts";
import { GizmoSettings } from "../features/viewport/GizmoSettings.ts";
import { SceneGizmo } from "../features/viewport/SceneGizmo.ts";
import { SceneHelpers } from "../features/viewport/SceneHelpers.ts";
import { SelectionHighlight } from "../features/viewport/SelectionHighlight.ts";
import type { SceneAction } from "../keybindings/sceneActions.ts";
import { sceneShortcuts } from "../keybindings/sceneShortcuts.ts";
import type { PresenceStore } from "../state/PresenceStore.ts";
import { SelectionStore } from "../state/SelectionStore.ts";

// CONSTANTS
const kCameraPreset = {
  focusMode: "elastic",
  position: { x: 6, y: 5, z: 10 },
  pivotPosition: { x: 0, y: 0, z: 0 },
  pitch: -0.35,
  yaw: 0.5,
  moveSpeed: 8,
  minMoveSpeed: 1,
  maxMoveSpeed: 120,
  scrollSpeed: 1,
  maxPivotDistance: 100,
  initialTrailDistance: 12
} as const;
const kFraming = {
  margin: 1.4,
  minDistance: 2
} as const;

export interface SceneEditorSceneOptions {
  document: SceneDocument;
  room: SceneRoom;
  openMap: MapViewerOpener;
  assetSlots: SceneAssetSlots;
  presence: PresenceStore;
  preferences: Preferences;
  keyBindings: KeyBindingSettings<SceneAction>;
}

export class SceneEditorScene extends Systems.Scene {
  #options: SceneEditorSceneOptions;
  #editing = Promise.withResolvers<SceneEditing>();
  #teardown = new Teardown();

  constructor(
    options: SceneEditorSceneOptions
  ) {
    super("scene-editor");
    this.#options = options;
  }

  get ready(): Promise<SceneEditing> {
    return this.#editing.promise;
  }

  override awake(): void {
    const {
      document,
      room,
      presence,
      assetSlots
    } = this.#options;
    const { world } = this;
    const teardown = this.#teardown;
    const scene = world.sceneManager.getSource();
    const grid = new Grid({
      cell: { size: 1 },
      section: { size: 10 }
    });
    scene.add(grid);
    teardown.defer(() => {
      scene.remove(grid);
      grid.geometry.dispose();
    });

    const camera = world
      .createActor("editor-camera")
      .addComponentAndGet(OrbitFlyCamera, kCameraPreset);
    const history = createSceneHistory(document);
    teardown.defer(() => history.dispose());
    const environment = new Systems.SceneEnvironment(world);
    teardown.defer(() => environment.dispose());
    const assets = new EditAssets(this.#options.openMap);
    teardown.defer(() => assets.dispose());
    const binding = new SceneBinding({
      world,
      document,
      components: createSceneDefinitions(),
      assets,
      environment
    });
    teardown.defer(() => binding.dispose());
    const selection = new SelectionStore(document);
    teardown.defer(() => selection.dispose());
    const actions = new SceneActions({
      document,
      history,
      selection,
      assetSlots
    });
    const gizmo = new GizmoSettings();
    world
      .createActor("scene-helpers")
      .addComponent(SceneHelpers, { binding });
    world
      .createActor("selection-highlight")
      .addComponent(SelectionHighlight, {
        renderer: world.renderer.getSource(),
        camera: camera.camera,
        binding,
        selection,
        presence
      });
    const sceneGizmo = new SceneGizmo({
      camera,
      canvas: world.renderer.canvas,
      scene,
      binding,
      document,
      selection,
      settings: gizmo
    });
    teardown.defer(() => sceneGizmo.dispose());
    world
      .createActor("actor-picker")
      .addComponent(ActorPicker, {
        camera: () => camera.camera,
        targets: binding,
        selection,
        busy: () => sceneGizmo.hovering || sceneGizmo.dragging
      });
    const collaboration = new SceneCollaboration({
      room,
      world,
      camera: camera.camera,
      selection,
      presence
    });
    teardown.defer(() => collaboration.dispose());

    function frameSelection(): void {
      const bounds = binding.worldBounds(selection.ids);
      if (!bounds.isEmpty()) {
        camera.frame(bounds, kFraming);
      }
    }
    function invalidate(): void {
      world.invalidate();
    }
    teardown.defer(selection.subscribe("change", invalidate));
    teardown.defer(followCameraPreferences(camera, this.#options.preferences));
    teardown.defer(this.#options.keyBindings.bind(
      world.input.keyboard,
      sceneShortcuts({
        history,
        actions,
        selection,
        gizmo,
        frameSelection
      })
    ));

    this.#editing.resolve({
      document,
      history,
      actions,
      selection,
      presence,
      gizmo,
      assetSlots,
      frameSelection,
      previewEnvironment: (patch) => binding.previewEnvironment(patch),
      teleportToPeer: (clientId) => {
        const pose = collaboration.peerPose(clientId);
        if (pose !== undefined) {
          camera.teleport(pose);
        }
      }
    });
  }

  override destroy(): void {
    this.#teardown.run();
    this.#editing.reject(
      new Error("The scene editor scene was destroyed before it awoke.")
    );

    super.destroy();
  }
}
