// Import Third-party Dependencies
import type { PresenceChannel } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { SoundPlayer } from "../player/SoundPlayer.ts";
import { PlaybackMark } from "./PlaybackMark.ts";

// CONSTANTS
const kHeartbeatMs = 2_000;

export interface PlaybackBeaconOptions {
  channel: PresenceChannel<PlaybackMark | null>;
  player: SoundPlayer;
  listening: () => boolean;
}

export class PlaybackBeacon {
  #channel: PresenceChannel<PlaybackMark | null>;
  #player: SoundPlayer;
  #listening: () => boolean;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #unsubscribe: () => void;

  constructor(
    options: PlaybackBeaconOptions
  ) {
    this.#channel = options.channel;
    this.#player = options.player;
    this.#listening = options.listening;
    this.#unsubscribe = this.#player.subscribe("change", () => {
      this.announce();
      this.#pace();
    });
    this.announce();
  }

  announce(): void {
    this.#channel.publish(
      PlaybackMark.capture(this.#player, this.#listening())
    );
  }

  dispose(): void {
    this.#unsubscribe();
    this.#stopHeartbeat();
    this.#channel.publish(null);
  }

  #pace(): void {
    if (!this.#player.playing) {
      this.#stopHeartbeat();
    }
    else if (this.#heartbeat === null) {
      this.#heartbeat = setInterval(() => this.announce(), kHeartbeatMs);
    }
  }

  #stopHeartbeat(): void {
    if (this.#heartbeat !== null) {
      clearInterval(this.#heartbeat);
      this.#heartbeat = null;
    }
  }
}
