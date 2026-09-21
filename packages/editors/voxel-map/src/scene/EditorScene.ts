// Import Third-party Dependencies
import {
  Systems,
  OrbitFlyCamera
} from "@jolly-pixel/engine";
import {
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer/plugins/engine/index.ts";
import type {
  VoxelEngine,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import * as THREE from "three";
import type { PeerIdentity } from "@jolly-pixel/ui";
import type { AssetLeases } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  MapDocument,
  RoomWorldSource,
  type VoxelMapRoom
} from "../document/index.ts";
import {
  BlockUsageStore,
  type EditorState
} from "../state/index.ts";
import { MapCollaboration } from "../collaboration/MapCollaboration.ts";
import {
  BrushShortcuts,
  HistoryShortcuts,
  LocalBrush
} from "../features/painting/index.ts";
import {
  ObjectLayerRenderer,
  VoxelLayerGizmo
} from "../features/layers/index.ts";
import {
  TilesetDirectory,
  type TilesetCatalog
} from "../features/tilesets/TilesetDirectory.ts";
import {
  TilesetActions,
  type TilesetCatalogWriter
} from "../features/tilesets/TilesetActions.ts";
import { TilesetAtlases } from "../features/tilesets/TilesetAtlases.ts";
import type { MapArchives } from "../features/map-config/MapArchives.ts";
import {
  LocalTilesetTextures,
  SessionTilesetTextures,
  type TilesetTextures
} from "../features/tilesets/TilesetTextures.ts";
import { GridRenderer } from "./GridRenderer.ts";
import { SceneLighting } from "./SceneLighting.ts";
import { installTransparency } from "./installTransparency.ts";
import { spawnPose } from "./spawnPose.ts";
import {
  viewFocusPoint,
  type ViewFocus
} from "./viewFocus.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kExitOrbitFocusKey = "Escape";

export interface EditorSceneSession {
  room: VoxelMapRoom;
  identity: PeerIdentity;
  catalog: TilesetCatalog & TilesetCatalogWriter;
  assets: AssetLeases;
  archives: MapArchives;
}

export interface EditorSceneOptions {
  state: EditorState;
  viewFocus: ViewFocus;
  session: EditorSceneSession;
  /**
   * MSAA sample count of the scene compositor.
   * @default 4
   */
  samples?: number;
}

export interface VoxelMapWorkspace {
  state: EditorState;
  mapDocument: MapDocument;
  usage: BlockUsageStore;
  engine: VoxelEngine;
  gridRenderer: GridRenderer;
  lighting: SceneLighting;
  localBrush: LocalBrush;
  tilesetActions: TilesetActions;
  textures: TilesetTextures;
  viewFocus: ViewFocus;
  archives: MapArchives;
  loadWorld(data: VoxelWorldJSON): void;
  teleportToPeer(clientId: string): void;
}

export class EditorScene extends Systems.Scene {
  #options: EditorSceneOptions;
  #workspace = Promise.withResolvers<VoxelMapWorkspace>();
  #disposables: Array<() => void> = [];
  #camera: OrbitFlyCamera | undefined;

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
      viewFocus,
      session,
      samples
    } = this.#options;
    const world = this.world;
    const scene = world.sceneManager.getSource();

    scene.background = new THREE.Color("#262627");
    const lighting = new SceneLighting(world.renderer.getSource());
    scene.add(...lighting.lights);
    this.#disposables.push(
      installTransparency(world.renderer, samples)
    );

    const camera = world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "lock"
      });
    this.#camera = camera;
    camera.teleport(spawnPose([]));

    const { keyboard } = world.input;
    const exitOrbitFocus = (): void => {
      camera.exitOrbitFocus();
      this.#announceCameraMode();
    };
    keyboard.on(kExitOrbitFocusKey, exitOrbitFocus);

    const { engine } = world
      .createActor("map")
      .addComponentAndGet(VoxelRenderer, {
        chunkSize: 16,
        layers: [],
        blocks: [],
        material: "lambert",
        tilesets: [],
        history: {
          enabled: true
        }
      });

    const mapDocument = new MapDocument({
      engine,
      source: new RoomWorldSource({
        engine,
        room: session.room,
        defaultLayerName: kDefaultLayerName
      })
    });
    const usage = new BlockUsageStore({
      mapDocument,
      source: engine.inspector.blocks
    });
    const tilesetDirectory = new TilesetDirectory({
      store: state.tilesets,
      tilesets: engine.tilesets,
      catalog: session.catalog,
      mapDocument
    });
    const tilesetActions = new TilesetActions({
      engine,
      catalog: session.catalog,
      store: state.tilesets
    });
    const textures = new SessionTilesetTextures(
      session.assets,
      new LocalTilesetTextures(engine)
    );
    const atlases = new TilesetAtlases({
      engine,
      store: state.tilesets,
      textures,
      mapDocument
    });

    viewFocus.provider = () => viewFocusPoint(camera.camera, engine.root);

    const gridRenderer = world
      .createActor("grid")
      .addComponentAndGet(GridRenderer, {
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
      });

    const localBrush = world
      .createActor("brush")
      .addComponentAndGet(LocalBrush, {
        engine,
        camera: camera.camera,
        brush: state.brush,
        selection: state.selection,
        color: session.identity.color
      });
    localBrush.onFocusRequest = (point) => {
      camera.enterOrbitFocus(point);
      this.#announceCameraMode();
    };

    const shortcuts = new BrushShortcuts({
      keyboard,
      brush: state.brush,
      selection: state.selection
    });
    const historyShortcuts = new HistoryShortcuts({
      keyboard,
      history: engine.history
    });

    world.createActor("gizmo")
      .addComponent(VoxelLayerGizmo, {
        world: engine.world,
        camera: camera.camera,
        selection: state.selection,
        mapDocument
      });
    world.createActor("object-layer-renderer")
      .addComponent(ObjectLayerRenderer, {
        world: engine.world,
        camera: camera.camera,
        selection: state.selection,
        mapDocument
      });
    const collaboration = new MapCollaboration({
      room: session.room,
      identity: session.identity,
      state,
      world,
      camera: camera.camera,
      localBrush
    });

    this.#disposables.push(
      () => keyboard.off(kExitOrbitFocusKey, exitOrbitFocus),
      state.selection.subscribe("gizmoDraggingChange", (dragging) => {
        camera.enabled = !dragging;
      }),
      mapDocument.subscribe("reset", () => {
        this.#selectFallbackLayer(engine);
        this.#spawnCamera(engine);
      }),
      () => shortcuts.dispose(),
      () => historyShortcuts.dispose(),
      () => collaboration.dispose(),
      () => atlases.dispose(),
      () => tilesetDirectory.dispose(),
      () => usage.dispose(),
      () => mapDocument.dispose(),
      () => {
        viewFocus.provider = null;
      }
    );

    this.#selectFallbackLayer(engine);
    session.room.join();

    this.#workspace.resolve({
      state,
      mapDocument,
      usage,
      engine,
      gridRenderer,
      lighting,
      localBrush,
      tilesetActions,
      textures,
      viewFocus,
      archives: session.archives,
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

  override destroy(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
    this.#camera = undefined;
    this.#workspace.reject(
      new Error("The editor scene was destroyed before it awoke.")
    );
  }

  #selectFallbackLayer(
    engine: VoxelEngine
  ): void {
    const { selection } = this.#options.state;
    const layers = engine.world.getLayers();
    const selected = selection.voxelLayer;
    if (
      selected !== null &&
      layers.some((layer) => layer.name === selected)
    ) {
      return;
    }

    selection.selectVoxelLayer(layers[0]?.name ?? null);
  }

  #spawnCamera(
    engine: VoxelEngine
  ): void {
    const camera = this.#camera;
    if (!this.#spawnPending || camera === undefined) {
      return;
    }

    this.#spawnPending = false;
    camera.exitOrbitFocus();
    camera.teleport(
      spawnPose(engine.world.getLayers(), {
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
