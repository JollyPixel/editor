// Import Third-party Dependencies
import {
  Systems
} from "@jolly-pixel/engine";
import {
  VoxelRenderer,
  TilesetLoader,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";
import type * as network from "@jolly-pixel/network";
import * as THREE from "three";

// Import Internal Dependencies
import {
  FreeFlyCamera,
  GridRenderer,
  VoxelBrush,
  LayerGizmo,
  ObjectLayerRenderer,
  PerformanceHUD
} from "../components/index.ts";
import type { EditorState } from "../EditorState.ts";

// CONSTANTS
/** Upper bound on the blocks derived from the default tileset. */
const kDefaultBlockLimit = 32;

export interface EditorSceneOptions {
  /**
   * The name of the default layer to create when the scene awakes. This can be
   * @default "Ground"
   */
  defaultLayerName?: string;
  tilesetLoader: TilesetLoader;
  /** Optional room to synchronize the voxel world over the network. */
  voxelRoom?: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
}

/**
 * Components the UI binds to, published once the scene has awoken.
 */
export interface EditorSceneHandles {
  vr: VoxelRenderer;
  gridRenderer: GridRenderer;
}

/**
 * Owns the synchronous ECS scene after its external resources are prepared.
 */
export class EditorScene extends Systems.Scene {
  #tilesetLoader: TilesetLoader;
  #defaultLayerName: string;
  #voxelRoom: network.Room<VoxelNetworkCommand, VoxelServerMessage> | undefined;
  #voxelSyncClient: VoxelSyncClient | undefined;
  #handles = Promise.withResolvers<EditorSceneHandles>();

  editorState: EditorState;

  vr: VoxelRenderer;
  gridRenderer: GridRenderer;

  /**
   * `awake()` runs on the first frame, which is after `loadRuntime()`
   * resolves. Anything needing `vr` or `gridRenderer` awaits this instead.
   */
  get ready(): Promise<EditorSceneHandles> {
    return this.#handles.promise;
  }

  constructor(
    editorState: EditorState,
    options: EditorSceneOptions
  ) {
    super("editor");

    const {
      defaultLayerName = "Ground",
      tilesetLoader,
      voxelRoom
    } = options;

    this.#defaultLayerName = defaultLayerName;
    this.#tilesetLoader = tilesetLoader;
    this.#voxelRoom = voxelRoom;
    this.editorState = editorState;
  }

  override awake() {
    const scene = this.world.sceneManager.getSource();

    scene.background = new THREE.Color("#262627");
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 10);
    scene.add(
      new THREE.AmbientLight("#ffffff", 0.6),
      dirLight
    );

    const world = this.world;

    const freeFlyCamera = world
      .createActor("camera")
      .addComponentAndGet(FreeFlyCamera, {
        position: { x: 8, y: 12, z: 32 }
      });

    const vr = world
      .createActor("map")
      .addComponentAndGet(VoxelRenderer, {
        chunkSize: 16,
        // Networked layers must be created after the sync client attaches.
        layers: this.#voxelRoom ? [] : [this.#defaultLayerName],
        blocks: [],
        material: "lambert",
        materialCustomizer: (material) => {
          material.transparent = true;
        },
        alphaTest: 0,
        onLayerUpdated: (evt) => this.editorState.dispatchLayerUpdated(evt),
        tilesetLoader: this.#tilesetLoader
      });
    this.vr = vr;

    if (this.#voxelRoom) {
      this.#voxelSyncClient = new VoxelSyncClient({ room: this.#voxelRoom });
      this.#voxelSyncClient.attach(vr.engine);
      // Snapshots bypass per-mutation hooks, so mirrored UI state must reset.
      this.#voxelSyncClient.on("snapshot", () => {
        let layers = vr.engine.world.getLayers();
        if (layers.length === 0) {
          // Creating the default now broadcasts it through the attached client.
          vr.engine.addLayer(this.#defaultLayerName);
          layers = vr.engine.world.getLayers();
        }

        const currentSelectionStillExists = this.editorState.selectedLayer !== null &&
          layers.some((layer) => layer.name === this.editorState.selectedLayer);
        if (!currentSelectionStillExists) {
          this.editorState.setSelectedLayer(layers[0].name);
        }

        this.#registerDefaultBlocks();
        this.editorState.dispatchBlockRegistryChanged();
        this.editorState.dispatchWorldReset();
      });
    }
    else {
      this.editorState.setSelectedLayer(this.#defaultLayerName);
    }

    this.gridRenderer = world
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

    this.#registerDefaultBlocks();
    this.editorState.dispatchBlockRegistryChanged();

    this.#voxelRoom?.join();

    world.createActor("brush")
      .addComponent(VoxelBrush, {
        vr,
        camera: freeFlyCamera.camera
      });

    world.createActor("gizmo")
      .addComponent(LayerGizmo, {
        vr,
        camera: freeFlyCamera.camera
      });

    world.createActor("object-layer-renderer")
      .addComponent(ObjectLayerRenderer, {
        vr,
        camera: freeFlyCamera.camera
      });

    world.createActor("perf-hud")
      .addComponent(PerformanceHUD, { vr });

    this.#handles.resolve({
      vr: this.vr,
      gridRenderer: this.gridRenderer
    });
  }

  /** Replaces the shared world, or only the local world when offline. */
  loadWorld(data: VoxelWorldJSON): void {
    if (this.#voxelSyncClient) {
      this.#voxelSyncClient.replaceWorld(data);
    }
    else {
      this.vr.engine.load(data);
      const layers = this.vr.engine.world.getLayers();
      this.editorState.setSelectedLayer(layers.length > 0 ? layers[0].name : null);
      this.editorState.dispatchBlockRegistryChanged();
      this.editorState.dispatchWorldReset();
    }
  }

  override destroy(): void {
    this.#handles.reject(
      new Error("The editor scene was destroyed before it awoke.")
    );
    this.#voxelSyncClient?.destroy();
    this.#voxelSyncClient = undefined;
  }

  /**
   * The document format carries no block definitions, so the registry is
   * rebuilt from the tileset. Existing ids are left alone because placed
   * voxels reference them.
   */
  #registerDefaultBlocks(): void {
    const { blockRegistry, tilesetManager } = this.vr.engine;

    for (const block of tilesetManager.getDefaultBlocks(void 0, { limit: kDefaultBlockLimit })) {
      if (!blockRegistry.has(block.id)) {
        blockRegistry.register(block);
      }
    }
  }
}
