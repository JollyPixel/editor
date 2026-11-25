// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";
import type { PresencePeer } from "@jolly-pixel/ui";
import { DriveSession } from "@jolly-pixel/ui/network";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  AnimationPlayer,
  PlaybackSpeed
} from "../player/AnimationPlayer.ts";
import { PlaybackBeacon } from "./PlaybackBeacon.ts";
import { PlaybackMark } from "./PlaybackMark.ts";

// CONSTANTS
const kPlaybackKey = "playback";

export type ModelCollaborationEvents = {
  change: () => void;
  peersChange: (peers: readonly PresencePeer[]) => void;
};

export interface ModelCollaborationOptions {
  room: Room;
  player: AnimationPlayer;
}

export class ModelCollaboration {
  readonly session: DriveSession;

  #player: AnimationPlayer;
  #events = new Emitter<ModelCollaborationEvents>();
  #playback: PresenceChannel<PlaybackMark | null>;
  #beacon: PlaybackBeacon;
  #unsubscribe: () => void;

  #onPlayback = (
    change: PresenceChange<PlaybackMark | null>
  ): void => {
    if (change.clientId === this.session.joinedId && change.value) {
      change.value.mirrorInto(this.#player);
    }
  };

  constructor(
    options: ModelCollaborationOptions
  ) {
    const { room, player } = options;
    this.#player = player;
    this.#playback = new PresenceChannel<PlaybackMark | null>(room, {
      key: kPlaybackKey,
      decode: (value) => PlaybackMark.parse(value)
    });
    this.session = new DriveSession({
      room,
      publish: (peers) => {
        this.#events.emit("peersChange", peers);
        this.#events.emit("change");
      },
      onJoinChange: () => {
        this.#rejoin();
        this.#events.emit("change");
      },
      onDriverChange: () => this.#beacon.announce()
    });
    this.#beacon = new PlaybackBeacon({
      channel: this.#playback,
      player,
      driving: () => this.session.driving
    });

    this.#playback.on("change", this.#onPlayback);
    this.#unsubscribe = player.subscribe("loaded", () => this.#rejoin());
  }

  get peers(): readonly PresencePeer[] {
    return this.session.peers;
  }

  subscribe<TEvent extends keyof ModelCollaborationEvents>(
    event: TEvent,
    listener: ModelCollaborationEvents[TEvent]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  toggle(): void {
    this.session.leave();
    this.#player.toggle();
  }

  stop(): void {
    this.session.leave();
    this.#player.stop();
  }

  seek(
    time: number
  ): void {
    this.session.leave();
    this.#player.seek(time);
  }

  select(
    clip: string
  ): void {
    this.session.leave();
    this.#player.select(clip);
  }

  toggleLoop(): void {
    this.session.leave();
    this.#player.loop = !this.#player.loop;
  }

  changeSpeed(
    speed: PlaybackSpeed
  ): void {
    this.session.leave();
    this.#player.speed = speed;
  }

  dispose(): void {
    this.#unsubscribe();
    this.#beacon.dispose();
    this.#playback.off("change", this.#onPlayback);
    this.#playback.destroy();
    this.session.dispose();
    this.#events.removeAllListeners();
  }

  #rejoin(): void {
    const { joinedId } = this.session;
    if (joinedId !== null) {
      this.#playback.values.get(joinedId)?.mirrorInto(this.#player);
    }
  }
}
