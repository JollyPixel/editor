// Import Third-party Dependencies
import {
  Systems,
  type ComponentInitializeContext
} from "@jolly-pixel/engine";
import {
  VoxelRenderer,
  TilesetLoader,
  type TilesetDefinition,
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
import { LocalStoragePersistence } from "../lib/LocalStoragePersistence.ts";

export interface EditorSceneOptions {
  /**
   * The name of the default layer to create when the scene awakes. This can be
   * @default "Ground"
   */
  defaultLayerName?: string;
  defaultTileset: TilesetDefinition;
  /** Optional room to synchronize the voxel world over the network. */
  voxelRoom?: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
}

export class EditorScene extends Systems.Scene {
  #tilesetLoader!: TilesetLoader;
  #defaultLayerName: string;
  #defaultTileset: TilesetDefinition;
  #voxelRoom: network.Room<VoxelNetworkCommand, VoxelServerMessage> | undefined;
  #voxelSyncClient: VoxelSyncClient | undefined;
  #pendingLoad: VoxelWorldJSON | null = null;

  editorState: EditorState;

  vr: VoxelRenderer;
  gridRenderer: GridRenderer;

  override async initialize(
    context: ComponentInitializeContext
  ): Promise<void> {
    const { assetManager } = context;

    this.#tilesetLoader = new TilesetLoader({ manager: assetManager.context.manager });
    // LocalStorage is an offline-only convenience: while a voxelRoom is
    // attached, the server snapshot is the sole source of truth — restoring
    // a stale local snapshot on top of a live session is what desyncs the
    // client from the server (see loadWorld()/awake()).
    this.#pendingLoad = this.#voxelRoom ? null : LocalStoragePersistence.load();

    // Pre-load world tilesets first (if restoring), then default (idempotent if already loaded).
    if (this.#pendingLoad !== null) {
      await this.#tilesetLoader.fromWorld(this.#pendingLoad);
    }
    await this.#tilesetLoader.fromTileDefinition(this.#defaultTileset);
  }

  constructor(
    editorState: EditorState,
    options: EditorSceneOptions
  ) {
    super("editor");

    const {
      defaultLayerName = "Ground",
      defaultTileset,
      voxelRoom
    } = options;

    this.#defaultLayerName = defaultLayerName;
    this.#defaultTileset = defaultTileset;
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
        // Networked mode starts empty — nothing may be created locally
        // before the sync client below is attached, or it becomes a layer
        // the server never learns about (see VoxelSyncServer's "dropped
        // invalid command" logging for what happens next).
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
      // "snapshot" fires for every full-world replace (the initial connect
      // snapshot, and any subsequent one from replaceWorld()/loadWorld()) —
      // unlike "ready", which only fires once. applySnapshot() bypasses the
      // usual per-mutation hooks, so the UI needs this explicit signal to
      // know it must re-read layers/selection from scratch.
      this.#voxelSyncClient.on("snapshot", () => {
        let layers = vr.engine.world.getLayers();
        if (layers.length === 0) {
          // A genuinely empty room (nobody has created anything yet) gets a
          // default layer so there's always something to paint on. Created
          // now — after the sync client is attached and the snapshot
          // confirmed empty — so it's properly broadcast, unlike the
          // constructor-time default layer this replaced.
          vr.engine.addLayer(this.#defaultLayerName);
          layers = vr.engine.world.getLayers();
        }

        const currentSelectionStillExists = this.editorState.selectedLayer !== null &&
          layers.some((layer) => layer.name === this.editorState.selectedLayer);
        if (!currentSelectionStillExists) {
          this.editorState.setSelectedLayer(layers[0].name);
        }

        this.editorState.dispatchBlockRegistryChanged();
        this.editorState.dispatchWorldReset();
      });
    }
    else {
      this.editorState.setSelectedLayer(this.#defaultLayerName);
    }

    // Built before the first dispatchBlockRegistryChanged() below — index.ts's
    // once-listener grabs `this.gridRenderer` on that first dispatch, so it
    // must already be assigned by then.
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

    // Skip default blocks when restoring a saved world — vr.load() will
    // register the persisted definitions (which carry user edits).
    // Registering defaults first would cause load() to skip saved blocks
    // because of its "skip already-registered IDs" guard.
    if (!this.#pendingLoad?.blocks?.length) {
      for (const block of vr.engine.tilesetManager.getDefaultBlocks(void 0, { limit: 32 })) {
        vr.engine.blockRegistry.register(block);
      }
    }
    this.editorState.dispatchBlockRegistryChanged();

    if (!this.#voxelRoom) {
      const persistence = new LocalStoragePersistence(vr, this.editorState);
      persistence.start();

      if (this.#pendingLoad !== null) {
        vr.engine.load(this.#pendingLoad);
        this.editorState.dispatchBlockRegistryChanged();
        const layers = vr.engine.world.getLayers();
        if (layers.length > 0) {
          this.editorState.setSelectedLayer(layers[0].name);
        }
        this.editorState.dispatchWorldReset();
        this.#pendingLoad = null;
      }
    }

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
  }

  /**
   * Replaces the world state, either as an authoritative broadcast to every
   * connected client (networked mode) or as a local-only load (offline mode).
   */
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
    this.#voxelSyncClient?.destroy();
    this.#voxelSyncClient = undefined;
  }
}
