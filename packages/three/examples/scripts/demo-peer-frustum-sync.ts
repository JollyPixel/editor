// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import {
  LocalStorageAdapter,
  peerColor,
  resolveStoredPrompt,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  Grid,
  PeerFrustum
} from "../../src/index.ts";
import { PeerFrustumSync } from "../../src/network/index.ts";
import {
  createRenderer,
  createScene,
  startLoop
} from "./utils/common.ts";
import { createFreeFlyCamera } from "./utils/free-fly-camera.ts";
import { createMirrorRoom } from "./utils/mirror-room.ts";
import {
  createExamplePane
} from "./utils/example-switcher.ts";
import { mountPerformanceStats } from "./utils/performance-stats.ts";

// CONSTANTS
const kRoomId = "three:peer-frustum-demo";
const kUsernameStorageKey = "peer-frustum-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

const kLocalPeerId = crypto.randomUUID();
const kBackground = "#1e2a30";
const kRoomSize = 20;

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene(kBackground);
scene.add(new Grid({
  extent: kRoomSize,
  followCamera: false,
  cell: { color: "#2a3439" },
  section: {
    size: 5,
    color: "#3a4750"
  },
  fade: {
    from: "origin",
    distance: kRoomSize * 0.6
  },
  axes: {
    show: false
  }
}));

const { camera, controls } = createFreeFlyCamera(
  canvas,
  { x: 0, y: 2, z: 8 }
);

const mirrorRoom = createMirrorRoom(camera, {
  size: kRoomSize,
  backdrop: kBackground
});
scene.add(mirrorRoom.group);

const pane = createExamplePane({
  title: "Peer Frustum (over network)"
});
const performanceStats = mountPerformanceStats(renderer);
const username = await resolveStoredPrompt({
  title: "Join peer frustum session",
  label: "Username",
  confirmLabel: "Join",
  storage: kUsernameStorage,
  storageKey: kUsernameStorageKey,
  fallbackValue: "Guest"
});

const networkClient = new network.Client({
  identity: {
    username,
    peerId: kLocalPeerId
  }
});
const room = networkClient.room(kRoomId);
room.join();

// Broadcasts this tab's camera as its "player" pose
const peerFrustumSync = new PeerFrustumSync({
  room,
  parent: scene,
  color: (clientId, identity) => colorForPeer(
    readPeerId(identity) ?? clientId
  )
});
peerFrustumSync.attach(camera);

const selfFrustum = new PeerFrustum({
  color: colorForPeer(kLocalPeerId),
  displayName: username
});
mirrorRoom.showOnlyInMirrors(selfFrustum);
scene.add(selfFrustum);

startLoop({
  renderer,
  scene,
  camera,
  controls,
  onFrame: () => {
    peerFrustumSync.update();
    selfFrustum.position.copy(camera.position);
    selfFrustum.quaternion.copy(camera.quaternion);
    refreshSession();
  },
  onBeforeRender: () => performanceStats.begin(),
  onAfterRender: () => performanceStats.end()
});

const sessionFolder = pane.addFolder({ title: "Session" });
const presence = sessionFolder.addPresence();
let presenceKey = "";
const sessionState = {
  you: username,
  peers: 0,
  controls: "click canvas, WASD + mouse to fly"
};
const mirrorState = { enabled: true };

sessionFolder.addButton({ title: "Change name" }).on("click", () => {
  sessionStorage.removeItem(kUsernameStorageKey);
  window.location.reload();
});

sessionFolder
  .addBinding(mirrorState, "enabled", { label: "mirrors" })
  .on("change", ({ value }) => {
    mirrorRoom.group.visible = value;
  });

sessionFolder.addSeparator();

sessionFolder.addMonitors(sessionState, {
  controls: { label: "controls" }
});

function refreshSession(): void {
  const peers = presencePeers();
  const key = peers.map(
    (peer) => `${peer.clientId}:${peer.displayName}:${peer.color}:${peer.self}`
  ).join("|");
  if (key === presenceKey) {
    return;
  }

  presenceKey = key;
  sessionState.peers = room.peers.size;
  // Colors here are derived from the peer list, so they shift on join/leave.
  peerFrustumSync.refreshColors();
  selfFrustum.color = colorForPeer(kLocalPeerId);
  sessionFolder.refresh();
  presence.update(peers);
}

function colorForPeer(
  peerId: string
): string {
  return peerColor(
    orderedPeerIds().indexOf(peerId)
  );
}

function orderedPeerIds(): string[] {
  return [
    kLocalPeerId,
    ...[...room.peers.values()].map(
      (peer) => readPeerId(peer.identity) ?? peer.clientId
    )
  ].sort();
}

function presencePeers(): PresencePeer[] {
  const remote = [...room.peers.values()]
    .map((peer) => {
      return {
        clientId: peer.clientId,
        displayName: readUsername(peer.identity),
        color: colorForPeer(readPeerId(peer.identity) ?? peer.clientId)
      };
    })
    .sort((a, b) => a.clientId.localeCompare(b.clientId));

  return [
    {
      clientId: kLocalPeerId,
      displayName: username,
      color: colorForPeer(kLocalPeerId),
      self: true
    },
    ...remote
  ];
}

function readUsername(
  identity: network.PeerMetadata | undefined
): string {
  return typeof identity?.username === "string" ? identity.username : "Guest";
}

function readPeerId(
  identity: network.PeerMetadata | undefined
): string | undefined {
  return typeof identity?.peerId === "string" ? identity.peerId : undefined;
}
