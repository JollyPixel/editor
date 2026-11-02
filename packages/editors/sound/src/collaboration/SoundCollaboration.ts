// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";
import type { PresencePeer } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { PlaybackMode } from "../player/PlaybackMode.ts";
import type { SoundPlayer } from "../player/SoundPlayer.ts";
import { DriveClaim } from "./DriveClaim.ts";
import { PlaybackBeacon } from "./PlaybackBeacon.ts";
import { PlaybackMark } from "./PlaybackMark.ts";
import {
  Playheads,
  type PeerPlayhead,
  type PlacedPeer
} from "./Playheads.ts";

// CONSTANTS
const kPlaybackKey = "playback";
const kDrivingBadge = "driving";

export type SoundStance =
  | {
    readonly kind: "alone";
  }
  | {
    readonly kind: "open";
  }
  | {
    readonly kind: "driving";
  }
  | {
    readonly kind: "following";
    readonly driver: PresencePeer;
    readonly listening: boolean;
  };

export type SoundCollaborationEvents = {
  change: () => void;
  peersChange: (peers: readonly PresencePeer[]) => void;
};

export interface SoundCollaborationOptions {
  room: Room;
  player: SoundPlayer;
}

export class SoundCollaboration {
  static #withDrivingBadge(
    peer: PresencePeer
  ): PresencePeer {
    return {
      ...peer,
      badge: peer.badge === undefined ?
        kDrivingBadge :
        `${peer.badge}, ${kDrivingBadge}`
    };
  }

  #player: SoundPlayer;
  #events = new Emitter<SoundCollaborationEvents>();
  #roster: PeerRoster;
  #playback: PresenceChannel<PlaybackMark | null>;
  #beacon: PlaybackBeacon;
  #claim: DriveClaim;
  #rosterPeers: readonly PresencePeer[] = [];
  #peers: readonly PresencePeer[] = [];
  #following: string | null = null;
  #unsubscribe: Array<() => void>;

  #onPlayback = (
    change: PresenceChange<PlaybackMark | null>
  ): void => {
    if (change.clientId === this.#following && change.value !== undefined) {
      this.#mirror(change.value);
    }
    this.#events.emit("change");
  };

  constructor(
    options: SoundCollaborationOptions
  ) {
    const { room, player } = options;
    this.#player = player;
    this.#playback = new PresenceChannel<PlaybackMark | null>(room, {
      key: kPlaybackKey,
      decode: (value) => PlaybackMark.parse(value)
    });
    this.#beacon = new PlaybackBeacon({
      channel: this.#playback,
      player,
      listening: () => this.#following !== null
    });
    this.#claim = new DriveClaim(room);
    this.#roster = new PeerRoster({
      room,
      publish: (peers) => {
        this.#rosterPeers = peers;
        this.#refreshPeers();
      }
    });

    this.#playback.on("change", this.#onPlayback);
    this.#unsubscribe = [
      this.#claim.subscribe(() => {
        this.#stopFollowing();
        this.#refreshPeers();
      }),
      player.subscribe("sound", () => this.#rejoin()),
      player.subscribe("resumed", () => {
        if (this.#following === null) {
          this.#beacon.announce();
        }
        else {
          this.#rejoin();
        }
      })
    ];
  }

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  get stance(): SoundStance {
    if (this.#peers.every((peer) => peer.self === true)) {
      return {
        kind: "alone"
      };
    }
    if (this.#claim.driving) {
      return {
        kind: "driving"
      };
    }

    const driver = this.#peers.find(
      (peer) => this.#claim.heldBy(peer.clientId)
    );

    return driver === undefined ?
      {
        kind: "open"
      } :
      {
        kind: "following",
        driver,
        listening: this.#following !== null
      };
  }

  subscribe<TEvent extends keyof SoundCollaborationEvents>(
    event: TEvent,
    listener: SoundCollaborationEvents[TEvent]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  play(): void {
    this.leave();
    this.#player.play();
  }

  seek(
    position: number
  ): void {
    this.leave();
    this.#player.seek(position);
  }

  pause(): void {
    this.leave();
    this.#player.pause();
  }

  retune(
    mode: PlaybackMode
  ): void {
    this.leave();
    this.#player.retune(mode);
  }

  drive(): void {
    this.#claim.claim();
  }

  release(): void {
    this.#claim.release();
  }

  listen(): void {
    const { stance } = this;
    if (stance.kind !== "following") {
      return;
    }

    this.#following = stance.driver.clientId;
    this.#mirror(this.#sharedMark(this.#following));
    this.#events.emit("change");
  }

  listenTo(
    clientId: string
  ): void {
    if (this.#claim.heldBy(clientId)) {
      this.listen();

      return;
    }

    const mark = this.#sharedMark(clientId);
    if (mark !== null) {
      this.leave();
      this.#mirror(mark);
    }
  }

  leave(): void {
    if (this.#following !== null) {
      this.#stopFollowing();
      this.#events.emit("change");
    }
  }

  playheads(): PeerPlayhead[] {
    const playheads = new Playheads(this.#placed(), this.#claim.driverId);

    return this.stance.kind === "alone" ?
      playheads.anonymous() :
      playheads.named();
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
    this.#beacon.dispose();
    this.#playback.off("change", this.#onPlayback);
    this.#playback.destroy();
    this.#claim.dispose();
    this.#roster.dispose();
    this.#events.removeAllListeners();
  }

  #stopFollowing(): void {
    this.#following = null;
    this.#beacon.announce();
  }

  #rejoin(): void {
    if (this.#following !== null) {
      this.#mirror(this.#sharedMark(this.#following));
    }
  }

  #mirror(
    mark: PlaybackMark | null
  ): void {
    if (mark === null) {
      this.#player.pause();
    }
    else {
      mark.mirrorInto(this.#player);
    }
  }

  #placed(): PlacedPeer[] {
    const { duration } = this.#player;
    if (duration === null) {
      return [];
    }

    return this.#peers.flatMap((peer) => this.#place(peer, duration) ?? []);
  }

  #place(
    peer: PresencePeer,
    duration: number
  ): PlacedPeer | null {
    if (peer.self === true) {
      const { elapsed } = this.#player;

      return elapsed === null ? null : {
        peer,
        position: elapsed / duration,
        listening: this.#following !== null
      };
    }

    const mark = this.#sharedMark(peer.clientId);
    const elapsed = mark?.elapsed(duration) ?? null;

    return mark === null || elapsed === null ? null : {
      peer,
      position: elapsed / duration,
      listening: mark.listening
    };
  }

  #sharedMark(
    clientId: string
  ): PlaybackMark | null {
    return this.#playback.values.get(clientId) ?? null;
  }

  #refreshPeers(): void {
    this.#peers = this.#rosterPeers.map(
      (peer) => (
        this.#claim.heldBy(peer.clientId) ?
          SoundCollaboration.#withDrivingBadge(peer) :
          peer
      )
    );
    this.#events.emit("peersChange", this.#peers);
    this.#events.emit("change");
  }
}
