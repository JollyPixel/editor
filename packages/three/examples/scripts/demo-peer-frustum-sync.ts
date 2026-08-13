// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import * as network from "@jolly-pixel/network/client";
import {
  LocalStorageAdapter,
  peerColor,
  resolveStoredPrompt,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PeerFrustumSync } from "./network/PeerFrustumSync.ts";
import {
  createRenderer,
  createScene,
  startLoop
} from "./utils/common.ts";
import { createFreeFlyCamera } from "./utils/free-fly-camera.ts";
import {
  createExamplePane
} from "./utils/example-switcher.ts";

// CONSTANTS
const kRoomId = "three:peer-frustum-demo";
const kUsernameStorageKey = "peer-frustum-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene("#1e2a30");
scene.add(new THREE.AxesHelper(1));
scene.add(new THREE.GridHelper(20, 20, "#3a4750", "#2a3439"));

const { camera, controls } = createFreeFlyCamera(
  canvas,
  { x: 0, y: 2, z: 8 }
);

const pane = createExamplePane({
  title: "Peer Frustum (over network)"
});
const username = await resolveStoredPrompt({
  title: "Join peer frustum session",
  label: "Username",
  confirmLabel: "Join",
  storage: kUsernameStorage,
  storageKey: kUsernameStorageKey,
  fallbackValue: "Guest"
});

const networkClient = new network.Client({
  identity: { username }
});
const room = networkClient.room(kRoomId);
room.join();

// Broadcasts this tab's camera as its "player" pose
const peerFrustumSync = new PeerFrustumSync({
  room,
  parent: scene,
  getColor: colorForPeer
});
peerFrustumSync.attach(camera);

startLoop({
  renderer,
  scene,
  camera,
  controls,
  onFrame: () => {
    peerFrustumSync.update();
    refreshSession();
  }
});

const sessionFolder = pane.addFolder({ title: "Session" });
const presence = sessionFolder.addPresence();
let presenceKey = "";
const sessionState = {
  you: username,
  peers: 0,
  controls: "click canvas, WASD + mouse to fly"
};

sessionFolder.addButton({ title: "Change name" }).on("click", () => {
  sessionStorage.removeItem(kUsernameStorageKey);
  window.location.reload();
});

sessionFolder.addSeparator();

sessionFolder.addMonitors(sessionState, {
  controls: { label: "controls" }
});

// `room.peers` only reflects the join snapshot once it round-trips over the
// socket, and no room event fires when it arrives — refreshing every frame
// (above) is what keeps this accurate instead of a stale 0 right after join.
function refreshSession(): void {
  const peers = presencePeers();
  const key = peers.map(
    (peer) => `${peer.id}:${peer.username}:${peer.color}:${peer.self}`
  ).join("|");
  if (key === presenceKey) {
    return;
  }

  presenceKey = key;
  sessionState.peers = room.peers.size;
  sessionFolder.refresh();
  presence.update(peers);
}

function colorForPeer(
  clientId: string
): string {
  return peerColor(
    peerIds().indexOf(clientId)
  );
}

function peerIds(): string[] {
  return [
    networkClient.id,
    ...room.peers.keys()
  ].sort();
}

function presencePeers(): PresencePeer[] {
  return peerIds().map((clientId) => {
    const peer = room.peers.get(clientId);

    return {
      id: clientId,
      username: clientId === networkClient.id ?
        username :
        readUsername(peer?.identity),
      color: colorForPeer(clientId),
      self: clientId === networkClient.id
    };
  });
}

function readUsername(
  identity: network.PeerMetadata | undefined
): string {
  return typeof identity?.username === "string" ? identity.username : "Guest";
}
