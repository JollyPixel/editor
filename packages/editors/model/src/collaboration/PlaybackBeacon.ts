// Import Third-party Dependencies
import type { PresenceChannel } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { AnimationPlayer } from "../player/AnimationPlayer.ts";
import { PlaybackMark } from "./PlaybackMark.ts";

// CONSTANTS
const kHeartbeatMs = 2_000;

export interface PlaybackBeaconOptions {
  channel: PresenceChannel<PlaybackMark | null>;
  player: AnimationPlayer;
  driving: () => boolean;
}

export class PlaybackBeacon {
  #channel: PresenceChannel<PlaybackMark | null>;
  #player: AnimationPlayer;
  #driving: () => boolean;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #unsubscribe: () => void;

  constructor(
    options: PlaybackBeaconOptions
  ) {
    this.#channel = options.channel;
    this.#player = options.player;
    this.#driving = options.driving;
    this.#unsubscribe = this.#player.subscribe(
      "change",
      () => this.announce()
    );
    this.announce();
  }

  announce(): void {
    const driving = this.#driving();
    this.#channel.publish(
      driving ? PlaybackMark.capture(this.#player) : null
    );
    if (driving && this.#player.playing) {
      this.#heartbeat ??= setInterval(() => this.announce(), kHeartbeatMs);
    }
    else {
      this.#stopHeartbeat();
    }
  }

  dispose(): void {
    this.#unsubscribe();
    this.#stopHeartbeat();
    this.#channel.publish(null);
  }

  #stopHeartbeat(): void {
    if (this.#heartbeat !== null) {
      clearInterval(this.#heartbeat);
      this.#heartbeat = null;
    }
  }
}
