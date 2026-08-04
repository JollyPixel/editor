// Import Third-party Dependencies
import * as THREE from "three";
import { Camera3DControls } from "@jolly-pixel/engine";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { TilesetLoader } from "../../src/tileset/TilesetLoader.ts";
import { VoxelRenderer } from "../../src/VoxelRenderer.ts";
import { VoxelSyncClient } from "../../src/network/VoxelSyncClient.ts";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "../../src/network/types.ts";
import { FlatWorldBrush } from "./components/FlatWorldBrush.ts";
import { PeerBrushes } from "./components/PeerBrushes.ts";
import {
  CHUNK_SIZE,
  FLAT_WORLD_ROOM,
  FLOOR_SIZE
} from "./utils/flatWorld.ts";
import { resolveUsername } from "./utils/presence.ts";
import { createTerrainTileset } from "./utils/terrainAtlas.ts";
import {
  PANE_RUNTIME_OPTIONS,
  createExamplePane
} from "./utils/pane.ts";

// CONSTANTS
const kSkyColor = "#8ec5e8";
const kCenter = FLOOR_SIZE / 2;

const canvas = document.querySelector("canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("HTMLCanvasElement not found");
}

const status = document.querySelector<HTMLElement>("#status")!;
const legend = document.querySelector<HTMLElement>("#peers")!;

const username = resolveUsername();
const tileset = createTerrainTileset();
const tilesetLoader = new TilesetLoader();
await tilesetLoader.fromTileDefinition(tileset.definition);

const runtime = new Runtime(canvas, {
  includePerformanceStats: false
});
const { world } = runtime;

const scene = world.sceneManager.getSource();
scene.background = new THREE.Color(kSkyColor);

const sun = new THREE.DirectionalLight(new THREE.Color("#fff6e0"), 2.2);
sun.position.set(FLOOR_SIZE, FLOOR_SIZE * 1.5, FLOOR_SIZE * 0.5);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#c6dcff"), 1.7),
  sun
);

// Sits just above the floor's top face, aligned to voxel boundaries.
const grid = new THREE.GridHelper(FLOOR_SIZE, FLOOR_SIZE, "#54707f", "#54707f");
grid.position.set(kCenter, 1.001, kCenter);
scene.add(grid);

const camera = world.createActor("camera")
  .addComponentAndGet(Camera3DControls, { speed: 20, far: 500 });
camera.actor.transform
  .setLocalPosition({ x: kCenter, y: 26, z: kCenter + 34 })
  .lookAt({ x: kCenter, y: 0, z: kCenter });

// No `layers`: the server owns the world, the first snapshot brings it in.
const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    chunkSize: CHUNK_SIZE,
    blocks: tileset.blocks,
    tilesetLoader,
    material: "lambert"
  });

const room = initializeWebsocketTransport();

const peers = world.createActor("peers")
  .addComponentAndGet(PeerBrushes, { room, username, legend });

const brush = world.createActor("brush")
  .addComponentAndGet(FlatWorldBrush, {
    engine: voxelMap.engine,
    camera: camera.camera
  });
brush.onBrushMoved = (position) => peers.report(position);

createExamplePane();
await loadRuntime(runtime, PANE_RUNTIME_OPTIONS);

/**
 * Voxel edits ride the engine hook into `VoxelSyncClient`; brush positions ride
 * the room's presence channel (see PeerBrushes). Both share one WebSocket.
 */
function initializeWebsocketTransport(): network.Room<
  VoxelNetworkCommand,
  VoxelServerMessage
> {
  const client = new network.Client({
    identity: { username }
  });
  client.on("ready", () => setStatus("connected: waiting for world…"));

  const room = client.room<VoxelNetworkCommand, VoxelServerMessage>(
    FLAT_WORLD_ROOM
  );
  room.on("peer-joined", ({ clientId }) => console.log(`[flat-world] peer joined: ${clientId}`));
  room.on("peer-left", ({ clientId }) => console.log(`[flat-world] peer left: ${clientId}`));
  room.on("denied", ({ event, reason }) => setStatus(`denied: ${event} (${reason})`, true));
  room.on("error", ({ event, reason }) => setStatus(`error: ${event} (${reason})`, true));

  const syncClient = new VoxelSyncClient({ room });
  // Must precede join(): a snapshot arriving with no attached engine is dropped.
  syncClient.attach(voxelMap.engine);
  syncClient.on("ready", () => setStatus(`synced as ${username}`));

  room.join();

  return room;
}

function setStatus(
  text: string,
  failed = false
): void {
  status.textContent = text;
  status.classList.toggle("failed", failed);
}
