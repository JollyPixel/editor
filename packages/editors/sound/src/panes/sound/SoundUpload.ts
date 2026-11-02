// Import Third-party Dependencies
import {
  SOUND_EXTENSION,
  SOUND_SOURCE_EXTENSIONS
} from "@jolly-pixel/asset.sound/client";

// Import Internal Dependencies
import { SoundFileError } from "./errors/SoundFileError.ts";

// CONSTANTS
const kMaxFileMb = 10;
const kMaxFileBytes = kMaxFileMb * 1024 * 1024;
const kExtensions: readonly string[] = [
  SOUND_EXTENSION,
  ...SOUND_SOURCE_EXTENSIONS
];

export class SoundUpload {
  static readonly accept = kExtensions.join(",");

  readonly from: string | undefined;

  #file: File;

  constructor(
    file: File
  ) {
    const dot = file.name.lastIndexOf(".");
    const extension = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
    if (!kExtensions.includes(extension)) {
      throw new SoundFileError(`"${file.name}" is not a sound file.`);
    }
    if (file.size > kMaxFileBytes) {
      throw new SoundFileError(
        `"${file.name}" is larger than ${kMaxFileMb} MB.`
      );
    }

    this.#file = file;
    this.from = extension === SOUND_EXTENSION ? undefined : extension;
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(
      await this.#file.arrayBuffer()
    );
  }
}
