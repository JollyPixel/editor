// Import Third-party Dependencies
import {
  Systems,
  OrbitFlyCamera
} from "@jolly-pixel/engine";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer/engine";
import {
  voxelTransparencyPass,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { PeerIdentity } from "@jolly-pixel/ui";
import type {
  AssetLeases,
  EditorArchives
} from "@jolly-pixel/editor.host";
import type {
  SyncedVoxelMap,
  VoxelMapRoom
} from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import {
  MapDocument,
  LeasedWorldSource
} from "../document/index.ts";
import type { EditorState } from "../state/index.ts";
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import { BlockUsageStore } from "../features/blocks/BlockUsageStore.ts";
import { blockRenderSourcesOf } from "../features/blocks/blockGeometry.ts";
import { LayerVisibilityStore } from "../features/layers/LayerVisibilityStore.ts";
import { LocalLayerVisibility } from "../features/layers/LocalLayerVisibility.ts";
import { ObjectLayerRenderer } from "../features/layers/objects/ObjectLayerRenderer.ts";
import { VoxelLayerGizmo } from "../features/layers/voxel/VoxelLayerGizmo.ts";
import { layerSelectionsOf } from "../features/layers/layerTree.ts";
import { MapCollaboration } from "../collaboration/MapCollaboration.ts";
import { LocalBrush } from "../features/painting/LocalBrush.ts";
import { bindBrushShortcuts } from "../features/painting/interaction/brushShortcuts.ts";
import { TemplatePlacement } from "../features/templates/placement/TemplatePlacement.ts";
import { bindTemplateShortcuts } from "../features/templates/placement/templateShortcuts.ts";
import { TemplateStore } from "../features/templates/TemplateStore.ts";
import {
  MapTilesets,
  type TilesetCatalog
} from "../features/tilesets/MapTilesets.ts";
import { openTileset } from "../features/tilesets/TilesetBinding.ts";
import {
  GridRenderer,
  type GridRendererOptions
} from "./GridRenderer.ts";
import { bindHistoryShortcuts } from "./historyShortcuts.ts";
import { SceneLighting } from "./SceneLighting.ts";
import { SceneEnvironment } from "./SceneEnvironment.ts";
import { spawnPose } from "./spawnPose.ts";
import { viewFocusPoint } from "../shared/viewRay.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kExitOrbitFocusKey = "Escape";
const kGrid: GridRendererOptions = {
  extent: 400,
  infiniteGrid: true,
  fade: {
    from: "camera",
    distance: 50
  },
  cell: {
    style: "lines"
  },
  section: {
    size: 16,
    color: "#4b4b4b"
  },
  hideCellOnSection: true,
  hideCellOnSectionFadeWidth: 1,
  axes: {
    show: false
  }
};

export interface EditorSceneSession {
  room: VoxelMapRoom;
  map: SyncedVoxelMap;
  identity: PeerIdentity;
  catalog: TilesetCatalog;
  assets: AssetLeases;
  archives: EditorArchives;
}

export interface EditorSceneOptions {
  state: EditorState;
  session: EditorSceneSession;
  samples?: number;
}

export class EditorScene extends Systems.Scene {
  #options: EditorSceneOptions;
  #workspace = Promise.withResolvers<VoxelMapWorkspace>();
  #disposables: Array<() => void> = [];
  #camera: OrbitFlyCamera | undefined;
  #environment: SceneEnvironment | undefined;

  #orbiting = false;
  #spawnPending = true;

  get ready(): Promise<VoxelMapWorkspace> {
    return this.#workspace.promise;
  }

  get camera(): OrbitFlyCamera | undefined {
    return this.#camera;
  }

  constructor(
    options: EditorSceneOptions
  ) {
    super("editor");
    this.#options = options;
  }

  override awake(): void {
    const {
      state,
      session,
      samples
    } = this.#options;
    const world = this.world;
    const scene = world.sceneManager.getSource();
    const templates = new TemplateStore();
    const layerVisibility = new LayerVisibilityStore();

    const lighting = new SceneLighting(world.renderer.getSource());
    scene.add(...lighting.lights);

    const camera = world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "lock",
        postProcessing: (context) => voxelTransparencyPass(
          context.scene,
          context.camera,
          samples === undefined ? {} : { samples }
        )
      });
    this.#camera = camera;
    camera.teleport(spawnPose([]));

    const { keyboard } = world.input;
    const exitOrbitFocus = (): void => {
      camera.exitOrbitFocus();
      this.#announceCameraMode();
    };
    keyboard.on(kExitOrbitFocusKey, exitOrbitFocus);

    const { view: engine } = world
      .createActor("map")
      .addComponentAndGet(VoxelRenderer, {
        document: session.map.voxels,
        rendering: {
          material: "lambert"
        },
        tilesets: []
      });

    const environment = new SceneEnvironment({
      renderer: world.renderer.getSource(),
      scene,
      lighting,
      chunks: engine.lighting
    });
    environment.apply(state.view.settings);
    this.#environment = environment;

    const blockSources = blockRenderSourcesOf(engine);
    const mapDocument = new MapDocument({
      commands: engine.document,
      source: new LeasedWorldSource({
        map: session.map,
        defaultLayerName: kDefaultLayerName
      })
    });
    const localVisibility = new LocalLayerVisibility({
      world: engine.document.world,
      mapDocument,
      visibility: layerVisibility
    });
    const usage = new BlockUsageStore({
      mapDocument,
      source: engine.inspector.blocks
    });
    const tilesets = new MapTilesets({
      engine,
      catalog: session.catalog,
      mapDocument,
      open: (assetId) => openTileset(session.assets, assetId)
    });

    const gridRenderer = world
      .createActor("grid")
      .addComponentAndGet(GridRenderer, kGrid);
    const collaboration = new MapCollaboration({
      room: session.room,
      identity: session.identity,
      state,
      world,
      camera: camera.camera
    });
    const localBrush = world
      .createActor("brush")
      .addComponentAndGet(LocalBrush, {
        engine,
        sources: blockSources,
        camera: camera.camera,
        brush: state.brush,
        selection: state.selection,
        pointer: state.pointer,
        color: session.identity.color,
        onCursorChange: (cursor) => collaboration.publishCursor(cursor),
        onFocusRequest: (point) => {
          camera.enterOrbitFocus(point);
          this.#announceCameraMode();
        },
        onPaintBlocked: () => {
          state.log.push("No voxel layer to paint on: add one in the Layers panel");
        }
      });

    world.createActor("gizmo")
      .addComponent(VoxelLayerGizmo, {
        world: engine.document.world,
        camera: camera.camera,
        selection: state.selection,
        pointer: state.pointer,
        mapDocument
      });
    world.createActor("template-placement")
      .addComponent(TemplatePlacement, {
        engine,
        sources: blockSources,
        camera: camera.camera,
        templates,
        pointer: state.pointer,
        mapDocument
      });
    world.createActor("object-layer-renderer")
      .addComponent(ObjectLayerRenderer, {
        world: engine.document.world,
        camera: camera.camera,
        selection: state.selection,
        pointer: state.pointer,
        mapDocument,
        visibility: layerVisibility
      });
    function reconcileTemplates(): void {
      templates.reconcile(
        Array.from(engine.document.world.templates, (template) => template.id)
      );
    }

    this.#disposables.push(
      () => keyboard.off(kExitOrbitFocusKey, exitOrbitFocus),
      state.pointer.subscribe("change", (captured) => {
        camera.enabled = !captured;
      }),
      templates.subscribe("placementChange", (placement) => {
        localBrush.suspended = placement !== null;
      }),
      mapDocument.subscribe("layerUpdated", () => {
        this.#reconcileSelection(engine);
      }),
      mapDocument.subscribe("templatesChanged", () => {
        reconcileTemplates();
      }),
      mapDocument.subscribe("reset", () => {
        this.#reconcileSelection(engine);
        reconcileTemplates();
        this.#spawnCamera(engine);
      }),
      state.view.subscribe("change", (settings) => {
        environment.apply(settings);
      }),
      bindBrushShortcuts({
        keyboard,
        brush: state.brush,
        selection: state.selection
      }),
      bindHistoryShortcuts({
        keyboard,
        history: engine.document.history
      }),
      bindTemplateShortcuts({
        keyboard,
        templates
      }),
      () => environment.dispose(),
      () => collaboration.dispose(),
      () => tilesets.dispose(),
      () => usage.dispose(),
      () => localVisibility.dispose(),
      () => mapDocument.dispose()
    );

    this.#reconcileSelection(engine);
    if (mapDocument.ready) {
      this.#spawnCamera(engine);
    }

    this.#workspace.resolve({
      state,
      mapDocument,
      usage,
      blockSources,
      templates,
      layerVisibility,
      engine,
      gridRenderer,
      localBrush,
      tilesets,
      archives: session.archives,
      focusPoint: () => viewFocusPoint(camera.camera, engine.root),
      loadWorld: (data) => {
        this.#spawnPending = true;
        mapDocument.load(data);
      },
      teleportToPeer: (clientId) => {
        const pose = collaboration.frustums.poseOf(clientId);
        if (pose !== undefined) {
          camera.teleport(pose);
        }
      }
    });
  }

  override update(): void {
    if (this.#camera !== undefined) {
      this.#environment?.follow(this.#camera.camera);
    }
  }

  override destroy(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
    this.#camera = undefined;
    this.#environment = undefined;
    this.#workspace.reject(
      new Error("The editor scene was destroyed before it awoke.")
    );
  }

  #reconcileSelection(
    engine: VoxelView
  ): void {
    this.#options.state.selection.reconcile(
      layerSelectionsOf(engine.document.world)
    );
  }

  #spawnCamera(
    engine: VoxelView
  ): void {
    const camera = this.#camera;
    if (!this.#spawnPending || camera === undefined) {
      return;
    }

    this.#spawnPending = false;
    camera.exitOrbitFocus();
    camera.teleport(
      spawnPose(engine.document.world.getLayers(), {
        fov: camera.camera.fov
      })
    );
    this.#announceCameraMode();
  }

  #announceCameraMode(): void {
    const orbiting = this.#camera?.isOrbiting ?? false;
    if (orbiting === this.#orbiting) {
      return;
    }

    this.#orbiting = orbiting;
    this.#options.state.log.push(
      orbiting
        ? "Camera switched to pivot"
        : "Camera switched to free fly"
    );
  }
}
