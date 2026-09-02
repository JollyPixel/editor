// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Camera3DControls } from "@jolly-pixel/engine";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import * as network from "@jolly-pixel/network/client";

// Registers the declarative controls declared by the example page.
import "@jolly-pixel/ui";

// Import Internal Dependencies
import { loadTilesets } from "../../src/tileset/loadTilesets.ts";
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
import { peerColor, resolveUsername } from "./utils/presence.ts";
import { createTerrainTileset } from "./utils/terrainAtlas.ts";
import {
  createExamplePane
} from "./utils/example-switcher.ts";

// CONSTANTS
const kSkyColor = "#c2e7ff";
const kCenter = FLOOR_SIZE / 2;

const username = await resolveUsername();
const tileset = createTerrainTileset();

const tilesets = await loadTilesets([tileset.definition]);

const runtime = await Runtime.create("canvas", {
  includePerformanceStats: false,
  focusCanvas: false
});
const { world } = runtime;

const scene = world.sceneManager.getSource();
scene.background = new THREE.Color(kSkyColor);

const sun = new THREE.DirectionalLight(new THREE.Color("#fff6e0"), 2.2);
sun.position.set(FLOOR_SIZE, FLOOR_SIZE * 1.5, FLOOR_SIZE * 0.5);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#eef4ff"), 1.7),
  sun
);

// Sits just above the floor's top face, aligned to voxel boundaries.
const grid = new THREE.GridHelper(FLOOR_SIZE, FLOOR_SIZE, "#183d03", "#183d03");
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
    tilesets,
    material: "lambert"
  });

const room = initializeWebsocketTransport();

const pane = createExamplePane({
  title: "Peers"
});
pane.hidden = false;
const presence = pane.addPresence();

const peers = world.createActor("peers")
  .addComponentAndGet(PeerBrushes, { room, username, presence });

const brush = world.createActor("brush")
  .addComponentAndGet(FlatWorldBrush, {
    engine: voxelMap.engine,
    camera: camera.camera,
    color: peerColor(username)
  });
brush.onBrushMoved = (position) => peers.report(position);

await loadRuntime(runtime);

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
  const room = client.room<VoxelNetworkCommand, VoxelServerMessage>(
    FLAT_WORLD_ROOM
  );
  room.on("peer-joined", ({ clientId }) => console.log(`[flat-world] peer joined: ${clientId}`));
  room.on("peer-left", ({ clientId }) => console.log(`[flat-world] peer left: ${clientId}`));
  room.on("denied", ({ event, reason }) => console.warn(
    `[flat-world] denied: ${event} (${reason})`
  ));
  room.on("error", ({ event, reason }) => console.error(
    `[flat-world] error: ${event} (${reason})`
  ));

  const syncClient = new VoxelSyncClient({ room });
  // Must precede join(): a snapshot arriving with no attached engine is dropped.
  syncClient.attach(voxelMap.engine);
  room.join();

  return room;
}
