// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";
import { Emitter } from "@openally/emitt";
import { clamp } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { LiveSettings } from "../settings/LiveSettings.ts";
import { LoopRegion } from "./LoopRegion.ts";
import type { Playback } from "./Playback.ts";
import { PlaybackMode } from "./PlaybackMode.ts";
import type { PlaybackTuning } from "./PlaybackTuning.ts";
import { DecodedSound } from "./sound/DecodedSound.ts";
import type {
  Sound,
  SoundFormat,
  SoundStatus,
  WaveformBar
} from "./sound/Sound.ts";
import { UnplayableSound } from "./sound/UnplayableSound.ts";
import { SpatialPreview } from "./spatial/SpatialPreview.ts";
import type { Voice } from "./Voice.ts";
import { Volume } from "./volume/Volume.ts";

// CONSTANTS
const kVolumeSmoothing = 0.01;

export type SoundPlayerEvents = {
  change: () => void;
  sound: () => void;
  settings: () => void;
  volume: () => void;
  resumed: () => void;
};

export class SoundPlayer {
  #context: AudioContext;
  #monitor: GainNode;
  #level: GainNode;
  #spatial: SpatialPreview;
  #events = new Emitter<SoundPlayerEvents>();
  #bytes: Uint8Array | null = null;
  #sound: Sound = UnplayableSound.empty;
  #settings: LiveSettings | null = null;
  #playback: Playback | null = null;
  #voices = new Systems.SoundVoices<Voice>();
  #cursor = 0;
  #mode = PlaybackMode.default;
  #volume = Volume.default;
  #unfollow: Array<() => void> = [];

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
    this.#monitor = context.createGain();
    this.#monitor.gain.value = this.#mode.monitorGain(this.#volume);
    this.#monitor.connect(context.destination);
    this.#level = context.createGain();
    this.#spatial = new SpatialPreview(context, this.#monitor, this);
    this.#level.connect(this.#spatial.input);
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

  get spatial(): SpatialPreview {
    return this.#spatial;
  }

  get settings(): Readonly<Systems.SoundSettings> {
    return this.#settings?.current ?? Systems.SOUND_SETTINGS_DEFAULTS;
  }

  get loopRegion(): LoopRegion | null {
    const { duration } = this;

    return duration === null ?
      null :
      LoopRegion.resolve(this.settings, duration);
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
    this.#applyVolume();
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
    settings: LiveSettings
  ): Promise<void> {
    this.#stopFollowing();
    this.#settings = settings;
    const { document } = settings;
    this.#unfollow = [
      document.subscribe(
        "reset",
        () => void this.#load(document.bytes)
      ),
      settings.subscribe("change", () => this.#onSettings())
    ];

    return this.#load(document.bytes);
  }

  tune(
    mode: PlaybackMode
  ): PlaybackTuning | null {
    const { duration } = this;

    return duration === null ? null : mode.tune(this.settings, duration);
  }

  retune(
    mode: PlaybackMode
  ): void {
    const playback = this.#playback;
    const tuning = this.tune(mode);
    if (playback !== null && tuning !== null) {
      if (tuning.reversed !== playback.tuning.reversed) {
        this.play(playback.elapsed(), mode);

        return;
      }
      playback.retune(tuning);
    }

    this.#mode = mode;
    this.#applyVolume();
    this.#events.emit("change");
  }

  seek(
    position: number
  ): void {
    const { duration } = this;
    if (duration === null) {
      return;
    }

    const offset = clamp(position, 0, 1) * duration;
    if (this.playing) {
      this.play(offset);
    }
    else {
      this.#cursor = offset;
      this.#events.emit("change");
    }
  }

  play(
    offset: number | null = null,
    mode = this.playing ? this.#mode : this.#mode.rerolled()
  ): void {
    const tuning = this.tune(mode);
    const playback = tuning === null ? null : this.#sound.play({
      context: this.#context,
      output: this.#level,
      tuning,
      offset: offset ?? this.#resumeAt(tuning)
    });
    if (playback === null) {
      return;
    }
    this.#halt();
    void this.#context.resume();

    playback.onEnded(() => {
      if (this.#playback === playback) {
        this.#playback = null;
        this.#cursor = playback.tuning.end();
        this.#events.emit("change");
      }
    });
    this.#playback = playback;
    this.#mode = mode;
    this.#applyVolume();
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

  trigger(): void {
    const sound = this.#sound;
    const { settings } = this;
    void this.#context.resume();
    this.#voices.start(
      sound,
      settings,
      this.#context.currentTime,
      () => sound.voice({
        context: this.#context,
        output: this.#spatial.input,
        rate: Systems.variedPitch(settings),
        volume: settings.volume
      })
    );
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
    this.#stopFollowing();
    this.#context.removeEventListener(
      "statechange",
      this.#onStateChange
    );
    this.#halt();
    this.#voices.stopAll();
    this.#level.disconnect();
    this.#spatial.dispose();
    this.#monitor.disconnect();
    this.#events.removeAllListeners();
    void this.#context.close();
  }

  #onSettings(): void {
    const playback = this.#playback;
    const tuning = this.tune(this.#mode);
    if (playback !== null && tuning !== null) {
      playback.retune(tuning);
    }
    this.#applyVolume();
    this.#events.emit("settings");
  }

  #applyVolume(): void {
    const now = this.#context.currentTime;
    this.#monitor.gain.setTargetAtTime(
      this.#mode.monitorGain(this.#volume),
      now,
      kVolumeSmoothing
    );
    this.#level.gain.setTargetAtTime(
      this.#mode.level(this.settings),
      now,
      kVolumeSmoothing
    );
  }

  #stopFollowing(): void {
    for (const unfollow of this.#unfollow) {
      unfollow();
    }
    this.#unfollow = [];
  }

  async #load(
    bytes: Uint8Array | null
  ): Promise<void> {
    if (bytes === this.#bytes) {
      return;
    }
    this.#bytes = bytes;
    this.pause();
    this.#voices.stopAll();
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
    tuning: PlaybackTuning
  ): number {
    return this.#cursor === tuning.end() ?
      tuning.start() :
      this.#cursor;
  }

  #halt(): void {
    const playback = this.#playback;
    this.#playback = null;
    playback?.halt();
  }
}
