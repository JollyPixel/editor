// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import { ColorPalette } from "@jolly-pixel/color";
import {
  LocalStorageAdapter,
  resolveStoredPrompt,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  Grid,
  PeerFrustum
} from "../../../src/index.ts";
import { PeerFrustumSync } from "../../../src/network/index.ts";
import { createExample } from "../../shared/example.ts";
import { PEER_FRUSTUM_ROOM } from "../../shared/rooms.ts";
import { freeFlyCamera } from "./free-fly-camera.ts";
import { createMirrorRoom } from "./mirror-room.ts";

// CONSTANTS
const kUsernameStorageKey = "peer-frustum-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

const kLocalPeerId = crypto.randomUUID();
const kBackground = "#1e2a30";
const kRoomSize = 20;

const {
  scene,
  camera,
  pane,
  start
} = await createExample({
  title: "Peer Frustum (over network)",
  background: kBackground,
  camera: freeFlyCamera({ x: 0, y: 2, z: 8 })
});

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

const mirrorRoom = createMirrorRoom(camera, {
  size: kRoomSize,
  backdrop: kBackground
});
scene.add(mirrorRoom.group);

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
const room = networkClient.room(PEER_FRUSTUM_ROOM);
room.join();

const colorPalette = new ColorPalette();

const peerFrustumSync = new PeerFrustumSync({
  room,
  parent: scene,
  color: (clientId, identity) => colorPalette.forKey(
    readPeerId(identity) ?? clientId
  )
});
peerFrustumSync.attach(camera);

const selfFrustum = new PeerFrustum({
  color: colorPalette.forKey(kLocalPeerId),
  displayName: username
});
mirrorRoom.showOnlyInMirrors(selfFrustum);
scene.add(selfFrustum);

const sessionFolder = pane.addFolder({ title: "Session" });
const presence = sessionFolder.addPresence();
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

room.on("sync", refreshSession);
room.on("peer-joined", refreshSession);
room.on("peer-left", refreshSession);
refreshSession();

start({
  update: () => {
    peerFrustumSync.update();
    selfFrustum.position.copy(camera.position);
    selfFrustum.quaternion.copy(camera.quaternion);
  }
});

function refreshSession(): void {
  sessionState.peers = room.peers.size;
  peerFrustumSync.refreshColors();
  sessionFolder.refresh();
  presence.update(presencePeers());
}

function presencePeers(): PresencePeer[] {
  const remote = [...room.peers.values()]
    .map((peer) => {
      return {
        clientId: peer.clientId,
        displayName: readUsername(peer.identity),
        color: colorPalette.forKey(readPeerId(peer.identity) ?? peer.clientId)
      };
    })
    .sort((a, b) => a.clientId.localeCompare(b.clientId));

  return [
    {
      clientId: kLocalPeerId,
      displayName: username,
      color: colorPalette.forKey(kLocalPeerId),
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
