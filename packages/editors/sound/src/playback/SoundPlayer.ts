// Import Third-party Dependencies
import type { SoundDocument } from "@jolly-pixel/asset.sound/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  waveformBars,
  type WaveformBar
} from "./waveformBars.ts";

// CONSTANTS
const kEmptySound: Sound = {
  status: "empty"
};
const kChannelLayouts: Record<number, string> = {
  1: "Mono",
  2: "Stereo"
};

export const EMPTY_READOUT: SoundReadout = {
  status: "empty",
  time: "0:00.0 / 0:00.0",
  format: null,
  playhead: null
};

type Sound =
  | {
    readonly status: "empty";
  }
  | {
    readonly status: "undecodable";
  }
  | {
    readonly status: "ready";
    readonly buffer: AudioBuffer;
  };

export type SoundStatus = Sound["status"];

export interface SoundReadout {
  readonly status: SoundStatus;
  readonly time: string;
  readonly format: string | null;
  readonly playhead: number | null;
}

export type SoundPlayerEvents = {
  change: () => void;
  sound: () => void;
};

interface Playback {
  source: AudioBufferSourceNode;
  startedAt: number;
  duration: number;
}

export class SoundPlayer {
  #context: AudioContext;
  #events = new Emitter<SoundPlayerEvents>();
  #bytes: Uint8Array | null = null;
  #sound: Sound = kEmptySound;
  #playback: Playback | null = null;
  #loop = false;
  #unfollow: (() => void) | null = null;

  constructor(
    context: AudioContext
  ) {
    this.#context = context;
  }

  get playing(): boolean {
    return this.#playback !== null;
  }

  get loop(): boolean {
    return this.#loop;
  }

  set loop(
    value: boolean
  ) {
    const playback = this.#playback;
    if (playback !== null) {
      playback.startedAt = this.#context.currentTime - this.#elapsed(playback);
      playback.source.loop = value;
    }
    this.#loop = value;
    this.#events.emit("change");
  }

  subscribe(
    event: keyof SoundPlayerEvents,
    listener: () => void
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  follow(
    document: SoundDocument
  ): Promise<void> {
    this.#unfollow?.();
    this.#unfollow = document.subscribe(
      "reset",
      () => void this.#load(document.bytes)
    );

    return this.#load(document.bytes);
  }

  play(): void {
    const sound = this.#sound;
    if (sound.status !== "ready") {
      return;
    }
    this.#halt();
    void this.#context.resume();

    const source = this.#context.createBufferSource();
    source.buffer = sound.buffer;
    source.loop = this.#loop;
    source.connect(this.#context.destination);
    const playback: Playback = {
      source,
      startedAt: this.#context.currentTime,
      duration: sound.buffer.duration
    };
    source.addEventListener("ended", () => {
      if (this.#playback === playback) {
        this.#playback = null;
        this.#events.emit("change");
      }
    });
    source.start();
    this.#playback = playback;
    this.#events.emit("change");
  }

  stop(): void {
    if (this.#playback !== null) {
      this.#halt();
      this.#events.emit("change");
    }
  }

  readout(): SoundReadout {
    const sound = this.#sound;
    if (sound.status !== "ready") {
      return {
        ...EMPTY_READOUT,
        status: sound.status
      };
    }

    const { buffer } = sound;
    const playback = this.#playback;
    const elapsed = playback === null ? 0 : this.#elapsed(playback);

    return {
      status: "ready",
      time: `${formatTime(elapsed)} / ${formatTime(buffer.duration)}`,
      format: formatLayout(buffer),
      playhead: playback === null ? null : elapsed / buffer.duration
    };
  }

  waveform(
    width: number,
    height: number
  ): WaveformBar[] {
    const sound = this.#sound;

    return sound.status === "ready" ?
      waveformBars(sound.buffer, width, height) :
      [];
  }

  dispose(): void {
    this.#unfollow?.();
    this.#halt();
    this.#events.removeAllListeners();
    void this.#context.close();
  }

  async #load(
    bytes: Uint8Array | null
  ): Promise<void> {
    if (bytes === this.#bytes) {
      return;
    }
    this.#bytes = bytes;
    this.stop();

    const sound = await this.#decode(bytes);
    if (bytes === this.#bytes) {
      this.#sound = sound;
      this.#events.emit("sound");
      this.#events.emit("change");
    }
  }

  async #decode(
    bytes: Uint8Array | null
  ): Promise<Sound> {
    if (bytes === null || bytes.byteLength === 0) {
      return kEmptySound;
    }

    try {
      const buffer = await this.#context.decodeAudioData(
        bytes.slice().buffer
      );
      if (buffer.length === 0) {
        return kEmptySound;
      }

      return {
        status: "ready",
        buffer
      };
    }
    catch {
      return {
        status: "undecodable"
      };
    }
  }

  #elapsed(
    playback: Playback
  ): number {
    const elapsed = this.#context.currentTime - playback.startedAt;

    return this.#loop ?
      elapsed % playback.duration :
      Math.min(elapsed, playback.duration);
  }

  #halt(): void {
    const playback = this.#playback;
    this.#playback = null;
    if (playback !== null) {
      playback.source.stop();
      playback.source.disconnect();
    }
  }
}

function formatTime(
  seconds: number
): string {
  const tenths = Math.round(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths % 600 / 10).toFixed(1).padStart(4, "0");

  return `${minutes}:${rest}`;
}

function formatLayout(
  buffer: AudioBuffer
): string {
  const rate = `${buffer.sampleRate / 1000} kHz`;
  const channels = kChannelLayouts[buffer.numberOfChannels] ??
    `${buffer.numberOfChannels} channels`;

  return `${rate} · ${channels}`;
}
