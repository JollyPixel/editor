// Import Third-party Dependencies
import type { SoundDocument } from "@jolly-pixel/asset.sound/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { Playback } from "./Playback.ts";
import { PlaybackMode } from "./PlaybackMode.ts";
import { DecodedSound } from "./sound/DecodedSound.ts";
import type {
  Sound,
  SoundFormat,
  SoundStatus,
  WaveformBar
} from "./sound/Sound.ts";
import { UnplayableSound } from "./sound/UnplayableSound.ts";
import { Volume } from "./volume/Volume.ts";

// CONSTANTS
const kVolumeSmoothing = 0.01;

export type SoundPlayerEvents = {
  change: () => void;
  sound: () => void;
  volume: () => void;
  resumed: () => void;
};

export class SoundPlayer {
  #context: AudioContext;
  #gain: GainNode;
  #events = new Emitter<SoundPlayerEvents>();
  #bytes: Uint8Array | null = null;
  #sound: Sound = UnplayableSound.empty;
  #playback: Playback | null = null;
  #cursor = 0;
  #mode = PlaybackMode.default;
  #volume = Volume.default;
  #unfollow: (() => void) | null = null;

  #onStateChange = (): void => {
    if (
      this.#context.state === "running" &&
      this.#playback !== null
    ) {
      this.#events.emit("resumed");
    }
  };

  constructor(
    context: AudioContext
  ) {
    this.#context = context;
    this.#gain = context.createGain();
    this.#gain.gain.value = this.#volume.gain();
    this.#gain.connect(context.destination);
    context.addEventListener(
      "statechange",
      this.#onStateChange
    );
  }

  get playing(): boolean {
    return this.#playback !== null;
  }

  get mode(): PlaybackMode {
    return this.#mode;
  }

  get volume(): Volume {
    return this.#volume;
  }

  set volume(
    volume: Volume
  ) {
    if (volume.equals(this.#volume)) {
      return;
    }
    this.#volume = volume;
    this.#gain.gain.setTargetAtTime(
      volume.gain(),
      this.#context.currentTime,
      kVolumeSmoothing
    );
    this.#events.emit("volume");
  }

  get status(): SoundStatus {
    return this.#sound.status;
  }

  get duration(): number | null {
    return this.#sound.duration;
  }

  get elapsed(): number | null {
    return this.#playback?.elapsed() ?? null;
  }

  get position(): number {
    return this.#playback?.elapsed() ?? this.#cursor;
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

  retune(
    mode: PlaybackMode
  ): void {
    const playback = this.#playback;
    const turning = mode.reversed !== this.#mode.reversed;
    this.#mode = mode;
    if (playback !== null && turning) {
      this.play(playback.elapsed(), mode);

      return;
    }
    playback?.retune(mode);
    this.#events.emit("change");
  }

  seek(
    position: number
  ): void {
    const { duration } = this;
    if (duration === null) {
      return;
    }

    const offset = Math.min(Math.max(position, 0), 1) * duration;
    if (this.playing) {
      this.play(offset);
    }
    else {
      this.#cursor = offset;
      this.#events.emit("change");
    }
  }

  play(
    offset = this.#resumeAt(this.#mode),
    mode = this.#mode
  ): void {
    this.#mode = mode;
    const playback = this.#sound.play({
      context: this.#context,
      output: this.#gain,
      mode,
      offset
    });
    if (playback === null) {
      return;
    }
    this.#halt();
    void this.#context.resume();

    playback.onEnded(() => {
      if (this.#playback === playback) {
        this.#playback = null;
        this.#cursor = this.#mode.end(this.duration ?? 0);
        this.#events.emit("change");
      }
    });
    this.#playback = playback;
    this.#events.emit("change");
  }

  pause(): void {
    const playback = this.#playback;
    if (playback !== null) {
      this.#cursor = playback.elapsed();
      this.#halt();
      this.#events.emit("change");
    }
  }

  timecode(): string {
    return this.#sound.timecode(this.position);
  }

  format(): SoundFormat | null {
    return this.#sound.format();
  }

  waveform(
    width: number,
    height: number
  ): WaveformBar[] {
    return this.#sound.waveform(width, height);
  }

  dispose(): void {
    this.#unfollow?.();
    this.#context.removeEventListener(
      "statechange",
      this.#onStateChange
    );
    this.#halt();
    this.#gain.disconnect();
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
    this.pause();
    if (bytes !== null) {
      this.#sound = UnplayableSound.decoding;
      this.#events.emit("change");
    }

    const sound = await this.#decode(bytes);
    if (bytes === this.#bytes) {
      this.#sound = sound;
      this.#cursor = 0;
      this.#events.emit("sound");
      this.#events.emit("change");
    }
  }

  async #decode(
    bytes: Uint8Array | null
  ): Promise<Sound> {
    if (bytes === null) {
      return UnplayableSound.empty;
    }

    try {
      const buffer = await this.#context.decodeAudioData(
        bytes.slice().buffer
      );

      return buffer.length === 0 ?
        UnplayableSound.empty :
        new DecodedSound(buffer);
    }
    catch {
      return UnplayableSound.undecodable;
    }
  }

  #resumeAt(
    mode: PlaybackMode
  ): number {
    const duration = this.duration ?? 0;

    return this.#cursor === mode.end(duration) ?
      mode.start(duration) :
      this.#cursor;
  }

  #halt(): void {
    const playback = this.#playback;
    this.#playback = null;
    playback?.halt();
  }
}
