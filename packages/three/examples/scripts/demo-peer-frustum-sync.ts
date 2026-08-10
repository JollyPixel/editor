// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PeerFrustumSync } from "./network/PeerFrustumSync.ts";
import {
  createRenderer,
  createScene,
  startLoop
} from "./utils/common.ts";
import { createFreeFlyCamera } from "./utils/free-fly-camera.ts";
import {
  addMonitors,
  createExamplePane,
  formatCount
} from "./utils/pane.ts";

// CONSTANTS
const kRoomId = "three:peer-frustum-demo";
const kUsernameStorageKey = "peer-frustum-demo:username";

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene("#1e2a30");
scene.add(new THREE.AxesHelper(1));
scene.add(new THREE.GridHelper(20, 20, "#3a4750", "#2a3439"));

const { camera, controls } = createFreeFlyCamera(canvas, { x: 0, y: 2, z: 8 });

const pane = createExamplePane();
const username = resolveUsername();

const networkClient = new network.Client({
  identity: { username }
});
const room = networkClient.room(kRoomId);
room.join();

// Broadcasts this tab's camera as its "player" pose, and mirrors every other
// connected tab's camera as a named PeerFrustum (name comes from `identity`
// above — see the default `getLabel` on PeerFrustumSync) — open this page in
// a second tab or window to see it appear.
const peerFrustumSync = new PeerFrustumSync({
  room,
  parent: scene
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
const sessionState = {
  you: username,
  peers: 0,
  controls: "click canvas, WASD + mouse to fly"
};
addMonitors(sessionFolder, sessionState, {
  you: { label: "you" },
  peers: { label: "peers", format: formatCount },
  controls: { label: "controls" }
});
sessionFolder.addButton({ title: "Change name" }).on("click", () => {
  sessionStorage.removeItem(kUsernameStorageKey);
  window.location.reload();
});

// `room.peers` only reflects the join snapshot once it round-trips over the
// socket, and no room event fires when it arrives — refreshing every frame
// (above) is what keeps this accurate instead of a stale 0 right after join.
function refreshSession(): void {
  if (sessionState.peers === room.peers.size) {
    return;
  }

  sessionState.peers = room.peers.size;
  sessionFolder.refresh();
}

function resolveUsername(): string {
  const cached = sessionStorage.getItem(kUsernameStorageKey);
  if (cached) {
    return cached;
  }

  // eslint-disable-next-line no-alert -- example-only UX
  const entered = window.prompt("Choose a username for this session")?.trim();
  const resolved = entered && entered.length > 0 ? entered : "Guest";
  sessionStorage.setItem(kUsernameStorageKey, resolved);

  return resolved;
}
