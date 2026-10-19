// Import Third-party Dependencies
import {
  OrbitFlyCamera,
  Systems
} from "@jolly-pixel/engine";
import { PeerFrustums } from "@jolly-pixel/editor.host";
import type { Room } from "@jolly-pixel/network/client";
import {
  TerrainLiveSync,
  type TerrainChange,
  type TerrainCommandDocument
} from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  TileCoord,
  type TerrainView
} from "@jolly-pixel/terrain.renderer";
import { TerrainRenderer } from "@jolly-pixel/terrain.renderer/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { PeerBrushRings } from "../features/sculpt/collaboration/PeerBrushRings.ts";
import type { SculptSettings } from "../features/sculpt/model/SculptSettings.ts";
import type { ViewSettings } from "../features/view/model/ViewSettings.ts";
import { SculptBrush } from "../features/sculpt/SculptBrush.ts";
import {
  bindHistoryShortcuts,
  type TerrainHistory
} from "../shared/terrainHistory.ts";

export interface TerrainEditorSceneOptions {
  document: TerrainCommandDocument;
  sculpt: SculptSettings;
  viewSettings: ViewSettings;
  history: TerrainHistory;
  room: Room;
}

export class TerrainEditorScene extends Systems.Scene {
  #document: TerrainCommandDocument;
  #sculpt: SculptSettings;
  #viewSettings: ViewSettings;
  #history: TerrainHistory;
  #room: Room;
  #view: TerrainView | null = null;
  #camera: OrbitFlyCamera | null = null;
  #teleport: (clientId: string) => void = () => undefined;
  #disposables: Array<() => void> = [];

  constructor(
    options: TerrainEditorSceneOptions
  ) {
    super("terrain-editor");
    this.#document = options.document;
    this.#sculpt = options.sculpt;
    this.#viewSettings = options.viewSettings;
    this.#history = options.history;
    this.#room = options.room;
  }

  get view(): TerrainView | null {
    return this.#view;
  }

  get camera(): OrbitFlyCamera | null {
    return this.#camera;
  }

  teleportToPeer(
    clientId: string
  ): void {
    this.#teleport(clientId);
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    const sun = new THREE.DirectionalLight("#fff4e0", 2.4);
    sun.position.set(-0.6, 1, 0.35);
    scene.add(sun, new THREE.HemisphereLight("#b9d4ff", "#4a3f30", 0.9));

    const camera = this.world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "elastic",
        position: { x: CHUNK_SAMPLES * 1.5, y: CHUNK_SAMPLES, z: CHUNK_SAMPLES * 1.5 },
        pivotPosition: { x: CHUNK_SAMPLES / 2, y: 0, z: CHUNK_SAMPLES / 2 },
        pitch: -0.5,
        moveSpeed: 40,
        minMoveSpeed: 5,
        maxMoveSpeed: 400,
        scrollSpeed: 4,
        maxPivotDistance: CHUNK_SAMPLES * 16,
        initialTrailDistance: CHUNK_SAMPLES * 1.5
      });
    this.#camera = camera;

    const { view } = this.world
      .createActor("terrain")
      .addComponentAndGet(TerrainRenderer, {
        terrain: this.#document.terrain,
        camera: () => camera.camera
      });
    this.#view = view;
    const viewSettings = this.#viewSettings;
    function applyViewSettings(): void {
      view.overlay = viewSettings.options.overlay;
      view.walkableSlope = viewSettings.options.walkableSlope;
    }
    applyViewSettings();
    this.#disposables.push(viewSettings.subscribe("change", applyViewSettings));
    const live = new TerrainLiveSync({
      room: this.#room,
      document: this.#document
    });
    const peerRings = this.world
      .createActor("peer-brush-rings")
      .addComponentAndGet(PeerBrushRings, {
        room: this.#room,
        terrain: this.#document.terrain,
        camera: () => camera.camera,
        interestChanged: (interest) => live.publishInterest(interest)
      });
    live.on("tilesChanged", (tiles) => {
      view.tilesChanged(tiles);
      peerRings.refresh();
      this.world.invalidate();
    });
    this.#disposables.push(() => live.dispose());
    this.world
      .createActor("sculpt-brush")
      .addComponent(SculptBrush, {
        document: this.#document,
        view,
        settings: this.#sculpt,
        history: this.#history,
        camera: () => camera.camera,
        publishRing: (shape) => peerRings.publishLocalRing(shape),
        liveTiles: (tiles) => live.queue(tiles)
      });
    this.#disposables.push(bindHistoryShortcuts(this.world.input.keyboard, this.#history));

    const frustums = this.world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room: this.#room,
        camera: camera.camera
      });
    this.#teleport = (clientId) => {
      const pose = frustums.peerPose(clientId);
      if (pose !== undefined) {
        camera.teleport(pose);
      }
    };

    function onChange(
      { command }: TerrainChange
    ): void {
      if (command.action === "heights-patched") {
        view.tilesChanged(command.tiles.map(
          ({ x, z, tile }) => TileCoord.fromIndex(new ChunkCoord(x, z), tile)
        ));
        peerRings.refresh();

        return;
      }

      const coord = new ChunkCoord(command.x, command.z);
      if (command.action === "chunk-added") {
        view.chunkAdded(coord);
      }
      else {
        view.chunkRemoved(coord);
      }
    }
    function onReset(): void {
      view.reset();
    }
    this.#document.on("change", onChange);
    this.#document.on("reset", onReset);
    this.#disposables.push(() => {
      this.#document.off("change", onChange);
      this.#document.off("reset", onReset);
    });
  }

  override destroy(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }

    super.destroy();
  }
}
