// Import Third-party Dependencies
import {
  OrbitFlyCamera,
  Systems,
  type OrbitFlyCameraOptions
} from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { Room } from "@jolly-pixel/network/client";
import {
  isPoiCommand,
  TerrainInterest,
  TerrainLiveReceiver,
  TerrainLiveSender,
  TerrainPreview,
  type TerrainDocument,
  type TerrainPreviewEvents
} from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type TerrainReader,
  type TerrainView
} from "@jolly-pixel/terrain.renderer";
import { TerrainRenderer } from "@jolly-pixel/terrain.renderer/engine";
import * as THREE from "three";

// Import Internal Dependencies
import {
  decodeMaterialImage,
  MaterialTextures
} from "../features/materials/rendering/MaterialTextures.ts";
import type { MaterialSelection } from "../features/materials/model/MaterialSelection.ts";
import type { TextureLeases } from "../features/materials/model/TextureLeases.ts";
import { ChunkTool } from "../features/chunks/ChunkTool.ts";
import type { PoiSelection } from "../features/poi/model/PoiSelection.ts";
import { PoiChunkTool } from "../features/poi/PoiChunkTool.ts";
import { PeerBrushRings } from "../features/sculpt/collaboration/PeerBrushRings.ts";
import type { SculptSettings } from "../features/sculpt/model/SculptSettings.ts";
import type { OverlaySettings } from "../features/overlays/model/OverlaySettings.ts";
import { SculptBrush } from "../features/sculpt/SculptBrush.ts";
import {
  bindHistoryShortcuts,
  type TerrainHistory
} from "../shared/terrainHistory.ts";

// CONSTANTS
const kCameraPreset: OrbitFlyCameraOptions = {
  position: {
    x: CHUNK_SAMPLES / 2,
    y: CHUNK_SAMPLES * 0.75,
    z: CHUNK_SAMPLES * 1.8
  },
  pitch: -0.5,
  moveSpeed: 40,
  minMoveSpeed: 5,
  maxMoveSpeed: 400
};

export interface TerrainEditorSceneOptions {
  document: TerrainDocument;
  sculpt: SculptSettings;
  overlaySettings: OverlaySettings;
  history: TerrainHistory;
  room: Room;
  leases: TextureLeases;
  selection: MaterialSelection;
  poiSelection: PoiSelection;
}

interface TerrainSceneParts {
  readonly camera: OrbitFlyCamera;
  readonly view: TerrainView;
  readonly preview: TerrainPreview;
  readonly live: TerrainLiveSender;
  readonly peerRings: PeerBrushRings;
  readonly brush: SculptBrush;
  readonly chunkTool: ChunkTool;
  readonly poiTool: PoiChunkTool;
  readonly frustums: PeerFrustums;
}

export class TerrainEditorScene extends Systems.Scene {
  #document: TerrainDocument;
  #sculpt: SculptSettings;
  #overlaySettings: OverlaySettings;
  #history: TerrainHistory;
  #room: Room;
  #leases: TextureLeases;
  #selection: MaterialSelection;
  #poiSelection: PoiSelection;
  #parts: TerrainSceneParts | null = null;
  #cameraPosition = new THREE.Vector3();
  #disposables: Array<() => void> = [];

  constructor(
    options: TerrainEditorSceneOptions
  ) {
    super("terrain-editor");
    this.#document = options.document;
    this.#sculpt = options.sculpt;
    this.#overlaySettings = options.overlaySettings;
    this.#history = options.history;
    this.#room = options.room;
    this.#leases = options.leases;
    this.#selection = options.selection;
    this.#poiSelection = options.poiSelection;
  }

  get view(): TerrainView {
    return this.#awakened().view;
  }

  get camera(): OrbitFlyCamera {
    return this.#awakened().camera;
  }

  get terrain(): TerrainReader {
    return this.#awakened().preview.terrain;
  }

  teleportToPeer(
    clientId: string
  ): void {
    const parts = this.#awakened();
    const pose = parts.frustums.peerPose(clientId);
    if (pose !== undefined) {
      parts.camera.teleport(pose);
    }
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    const sun = new THREE.DirectionalLight("#fff4e0", 2.4);
    sun.position.set(-0.6, 1, 0.35);
    scene.add(sun, new THREE.HemisphereLight("#b9d4ff", "#4a3f30", 0.9));

    const room = this.#room;
    const preview = new TerrainPreview(this.#document);
    const live = new TerrainLiveSender({ room, preview });
    const receiver = new TerrainLiveReceiver({ room, preview });
    this.#disposables.push(
      () => preview.dispose(),
      () => live.dispose(),
      () => receiver.dispose()
    );

    const camera = this.world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, kCameraPreset);
    const { view } = this.world
      .createActor("terrain")
      .addComponentAndGet(TerrainRenderer, {
        terrain: preview.terrain,
        camera: () => camera.camera
      });
    this.#bindOverlaySettings(view);
    this.#bindPointsOfInterest(view);
    const materialTextures = new MaterialTextures({
      document: this.#document,
      view,
      leases: this.#leases,
      decode: decodeMaterialImage,
      failed: (assetId, error) => console.warn(`[terrain] Texture ${assetId} cannot be drawn.`, error)
    });
    this.#disposables.push(() => materialTextures.dispose());

    const poiSelection = this.#poiSelection;
    function editingPoi(): boolean {
      return poiSelection.editing;
    }
    const peerRings = this.world
      .createActor("peer-brush-rings")
      .addComponentAndGet(PeerBrushRings, {
        room,
        terrain: preview.terrain,
        sender: live
      });
    const brush = this.world
      .createActor("sculpt-brush")
      .addComponentAndGet(SculptBrush, {
        document: this.#document,
        preview,
        settings: this.#sculpt,
        selection: this.#selection,
        history: this.#history,
        camera: camera.camera,
        rings: peerRings,
        paused: editingPoi
      });
    const chunkTool = this.world
      .createActor("chunk-tool")
      .addComponentAndGet(ChunkTool, {
        document: this.#document,
        preview,
        settings: this.#sculpt,
        history: this.#history,
        camera: camera.camera,
        paused: editingPoi
      });
    const poiTool = this.world
      .createActor("poi-chunk-tool")
      .addComponentAndGet(PoiChunkTool, {
        document: this.#document,
        preview,
        selection: this.#poiSelection,
        history: this.#history,
        camera: camera.camera
      });
    const frustums = this.world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room,
        camera: camera.camera
      });
    this.#disposables.push(bindHistoryShortcuts(this.world.input.keyboard, this.#history));

    this.#bindPreview(preview, view, () => {
      peerRings.refresh();
      brush.terrainChanged();
      chunkTool.terrainChanged();
      poiTool.terrainChanged();
    });
    this.#parts = {
      camera,
      view,
      preview,
      live,
      peerRings,
      brush,
      chunkTool,
      poiTool,
      frustums
    };
  }

  override update(): void {
    const parts = this.#parts;
    if (parts === null) {
      return;
    }

    const position = parts.camera.camera.getWorldPosition(this.#cameraPosition);
    const chunk = ChunkCoord.containing(position.x, position.z);
    this.#document.stream.follow(chunk);
    if (parts.live.interest?.centre.equals(chunk) === true) {
      return;
    }

    const interest = TerrainInterest.around(position.x, position.z);
    if (parts.live.publishInterest(interest)) {
      parts.peerRings.refresh();
      this.world.invalidate();
    }
  }

  override destroy(): void {
    this.#parts?.brush.endStroke();
    this.#parts?.chunkTool.endDrag();
    this.#parts?.poiTool.endDrag();
    for (const dispose of this.#disposables.splice(0).reverse()) {
      dispose();
    }
    this.#parts = null;

    super.destroy();
  }

  #awakened(): TerrainSceneParts {
    if (this.#parts === null) {
      throw new Error("The terrain editor scene is not awake.");
    }

    return this.#parts;
  }

  #bindOverlaySettings(
    view: TerrainView
  ): void {
    const overlaySettings = this.#overlaySettings;
    function applyOverlaySettings(): void {
      view.overlay = overlaySettings.options.overlay;
      view.walkableSlope = overlaySettings.options.walkableSlope;
    }
    applyOverlaySettings();
    this.#disposables.push(overlaySettings.subscribe("change", applyOverlaySettings));

    const sculpt = this.#sculpt;
    function revealForTool(): void {
      const { tool } = sculpt.options;
      view.revealHoles = tool === "holes";
      view.revealChunks = tool === "chunks";
    }
    revealForTool();
    this.#disposables.push(sculpt.subscribe("change", revealForTool));

    const terrain = this.#document;
    const selection = this.#selection;
    function highlightSelected(): void {
      const { selected } = selection;
      const material = selected === null ? undefined : terrain.materials.material(selected);
      view.highlightedMaterial = material?.slot ?? null;
    }
    highlightSelected();
    this.#disposables.push(selection.subscribe("change", highlightSelected));
  }

  #bindPointsOfInterest(
    view: TerrainView
  ): void {
    const document = this.#document;
    const selection = this.#poiSelection;
    function focus(): void {
      view.focusOn(document.pointsOfInterest.pointsOfInterest());
      highlight();
    }
    function highlight(): void {
      const { selected } = selection;
      const point = selected === null ? undefined : document.pointsOfInterest.pointOfInterest(selected);
      const chunks = point?.chunks ?? [];
      view.highlightChunks(chunks.map(({ x, z }) => new ChunkCoord(x, z)));
    }
    focus();
    this.#disposables.push(
      document.subscribe("change", ({ command }) => {
        if (isPoiCommand(command)) {
          focus();
        }
      }),
      document.subscribe("reset", focus),
      selection.subscribe("change", highlight)
    );
  }

  #bindPreview(
    preview: TerrainPreview,
    view: TerrainView,
    surfaceChanged: () => void
  ): void {
    const listeners: Pick<
      TerrainPreviewEvents,
      | "tilesChanged"
      | "splatChanged"
      | "holesChanged"
      | "chunkAdded"
      | "chunkRemoved"
      | "overviewChanged"
      | "reset"
    > = {
      tilesChanged: (tiles) => {
        view.tilesChanged(tiles);
        surfaceChanged();
        this.world.invalidate();
      },
      splatChanged: (tiles) => view.splatChanged(tiles),
      holesChanged: (tiles) => view.holesChanged(tiles),
      chunkAdded: (coord) => view.chunkAdded(coord),
      chunkRemoved: (coord) => view.chunkRemoved(coord),
      overviewChanged: (coords) => view.overviewChanged(coords),
      reset: () => {
        view.reset();
        surfaceChanged();
      }
    };
    preview.on("tilesChanged", listeners.tilesChanged);
    preview.on("splatChanged", listeners.splatChanged);
    preview.on("holesChanged", listeners.holesChanged);
    preview.on("chunkAdded", listeners.chunkAdded);
    preview.on("chunkRemoved", listeners.chunkRemoved);
    preview.on("overviewChanged", listeners.overviewChanged);
    preview.on("reset", listeners.reset);
    this.#disposables.push(() => {
      preview.off("tilesChanged", listeners.tilesChanged);
      preview.off("splatChanged", listeners.splatChanged);
      preview.off("holesChanged", listeners.holesChanged);
      preview.off("chunkAdded", listeners.chunkAdded);
      preview.off("chunkRemoved", listeners.chunkRemoved);
      preview.off("overviewChanged", listeners.overviewChanged);
      preview.off("reset", listeners.reset);
    });
  }
}
