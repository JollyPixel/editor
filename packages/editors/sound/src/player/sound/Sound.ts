// Import Internal Dependencies
import type { Playback } from "../Playback.ts";
import type { PlaybackMode } from "../PlaybackMode.ts";

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
  mode: PlaybackMode;
  offset: number;
}

export interface Sound {
  readonly status: SoundStatus;
  readonly duration: number | null;
  timecode(elapsed: number | null): string;
  format(): SoundFormat | null;
  waveform(width: number, height: number): WaveformBar[];
  play(options: SoundPlayOptions): Playback | null;
}
