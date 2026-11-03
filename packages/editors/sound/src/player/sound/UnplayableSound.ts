// Import Internal Dependencies
import type {
  Sound,
  SoundStatus
} from "./Sound.ts";
import { Timecode } from "./Timecode.ts";

export type UnplayableStatus = Exclude<SoundStatus, "ready">;

export class UnplayableSound implements Sound {
  static readonly empty = new UnplayableSound("empty");
  static readonly decoding = new UnplayableSound("decoding");
  static readonly undecodable = new UnplayableSound("undecodable");

  readonly status: UnplayableStatus;
  readonly duration = null;

  constructor(
    status: UnplayableStatus
  ) {
    this.status = status;
  }

  timecode(): string {
    return `${Timecode.zero} / ${Timecode.zero}`;
  }

  format(): null {
    return null;
  }

  waveform(): [] {
    return [];
  }

  play(): null {
    return null;
  }
}
