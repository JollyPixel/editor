// Import Third-party Dependencies
import type {
  JollyPeerSelectDetail,
  PresencePeer,
  PresenceStack
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";

export class CollaboratorStack {
  readonly #element: PresenceStack;
  #workspace: VoxelMapWorkspace | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor(
    element: PresenceStack
  ) {
    this.#element = element;
    this.#element.addEventListener("jolly-peer-select", this.#onPeerSelect);
  }

  attach(
    workspace: VoxelMapWorkspace
  ): void {
    this.#unsubscribe?.();
    this.#workspace = workspace;
    this.#show(workspace.state.presence.peers);
    this.#unsubscribe = workspace.state.presence.subscribe(
      "peersChange",
      (peers) => this.#show(peers)
    );
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#workspace = null;
    this.#element.removeEventListener("jolly-peer-select", this.#onPeerSelect);
  }

  #show(
    peers: readonly PresencePeer[]
  ): void {
    this.#element.peers = peers;
    this.#element.hidden = peers.every((peer) => peer.self);
  }

  readonly #onPeerSelect = (
    event: CustomEvent<JollyPeerSelectDetail>
  ): void => {
    this.#workspace?.teleportToPeer(event.detail.clientId);
  };
}
