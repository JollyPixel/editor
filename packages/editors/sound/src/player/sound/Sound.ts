// Import Internal Dependencies
import type { Playback } from "../Playback.ts";
import type { PlaybackTuning } from "../PlaybackTuning.ts";
import type { Voice } from "../Voice.ts";

export type SoundStatus = "empty" | "decoding" | "undecodable" | "ready";

export interface SoundFormat {
  readonly sampleRate: string;
  readonly channels: string;
}

export interface WaveformBar {
  readonly top: number;
  readonly height: number;
}

export interface SoundPlayOptions {
  context: BaseAudioContext;
  output: AudioNode;
  tuning: PlaybackTuning;
  offset: number;
}

export interface SoundVoiceOptions {
  context: BaseAudioContext;
  output: AudioNode;
  rate: number;
  volume: number;
}

export interface Sound {
  readonly status: SoundStatus;
  readonly duration: number | null;
  timecode(elapsed: number | null): string;
  format(): SoundFormat | null;
  waveform(width: number, height: number): WaveformBar[];
  play(options: SoundPlayOptions): Playback | null;
  voice(options: SoundVoiceOptions): Voice | null;
}
