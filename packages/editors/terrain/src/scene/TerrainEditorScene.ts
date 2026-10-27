// Import Third-party Dependencies
import {
  OrbitFlyCamera,
  Systems,
  type OrbitFlyCameraOptions
} from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { Room } from "@jolly-pixel/network/client";
import {
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
  MaterialTextures,
  type TextureLease
} from "../features/materials/rendering/MaterialTextures.ts";
import type { MaterialSelection } from "../features/materials/model/MaterialSelection.ts";
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
  focusMode: "elastic",
  position: {
    x: CHUNK_SAMPLES * 1.5,
    y: CHUNK_SAMPLES,
    z: CHUNK_SAMPLES * 1.5
  },
  pivotPosition: {
    x: CHUNK_SAMPLES / 2,
    y: 0,
    z: CHUNK_SAMPLES / 2
  },
  pitch: -0.5,
  moveSpeed: 40,
  minMoveSpeed: 5,
  maxMoveSpeed: 400,
  scrollSpeed: 4,
  maxPivotDistance: CHUNK_SAMPLES * 16,
  initialTrailDistance: CHUNK_SAMPLES * 1.5
};

export interface TerrainEditorSceneOptions {
  document: TerrainDocument;
  sculpt: SculptSettings;
  overlaySettings: OverlaySettings;
  history: TerrainHistory;
  room: Room;
  textures: (assetId: string) => TextureLease;
  selection: MaterialSelection;
}

interface TerrainSceneParts {
  readonly camera: OrbitFlyCamera;
  readonly view: TerrainView;
  readonly preview: TerrainPreview;
  readonly live: TerrainLiveSender;
  readonly peerRings: PeerBrushRings;
  readonly brush: SculptBrush;
  readonly frustums: PeerFrustums;
}

export class TerrainEditorScene extends Systems.Scene {
  #document: TerrainDocument;
  #sculpt: SculptSettings;
  #overlaySettings: OverlaySettings;
  #history: TerrainHistory;
  #room: Room;
  #textures: (assetId: string) => TextureLease;
  #selection: MaterialSelection;
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
    this.#textures = options.textures;
    this.#selection = options.selection;
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
    const materialTextures = new MaterialTextures({
      document: this.#document,
      view,
      lease: this.#textures,
      decode: decodeMaterialImage,
      failed: (assetId, error) => console.warn(`[terrain] Texture ${assetId} cannot be drawn.`, error)
    });
    this.#disposables.push(() => materialTextures.dispose());

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
        rings: peerRings
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
    });
    this.#parts = {
      camera,
      view,
      preview,
      live,
      peerRings,
      brush,
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
  }

  #bindPreview(
    preview: TerrainPreview,
    view: TerrainView,
    surfaceChanged: () => void
  ): void {
    const listeners: Pick<
      TerrainPreviewEvents,
      "tilesChanged" | "splatChanged" | "chunkAdded" | "chunkRemoved" | "overviewChanged" | "reset"
    > = {
      tilesChanged: (tiles) => {
        view.tilesChanged(tiles);
        surfaceChanged();
        this.world.invalidate();
      },
      splatChanged: (tiles) => view.splatChanged(tiles),
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
    preview.on("chunkAdded", listeners.chunkAdded);
    preview.on("chunkRemoved", listeners.chunkRemoved);
    preview.on("overviewChanged", listeners.overviewChanged);
    preview.on("reset", listeners.reset);
    this.#disposables.push(() => {
      preview.off("tilesChanged", listeners.tilesChanged);
      preview.off("splatChanged", listeners.splatChanged);
      preview.off("chunkAdded", listeners.chunkAdded);
      preview.off("chunkRemoved", listeners.chunkRemoved);
      preview.off("overviewChanged", listeners.overviewChanged);
      preview.off("reset", listeners.reset);
    });
  }
}
