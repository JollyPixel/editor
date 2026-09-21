// Import Internal Dependencies
import { EditorLaunch } from "../EditorLaunch.ts";
import type { LaunchSource } from "./LaunchSource.ts";

// CONSTANTS
export const LAST_OPENED_STORAGE_PREFIX = "jolly-pixel:last-opened:";

export interface LastOpenedLaunchSourceOptions {
  accepts: string;
  isKnown(assetId: string): boolean;
}

export class LastOpenedLaunchSource implements LaunchSource {
  static remember(
    accepts: string,
    assetId: string
  ): boolean {
    try {
      globalThis.localStorage?.setItem(
        `${LAST_OPENED_STORAGE_PREFIX}${accepts}`,
        assetId
      );

      return true;
    }
    catch {
      return false;
    }
  }

  #accepts: string;
  #isKnown: (assetId: string) => boolean;

  constructor(
    options: LastOpenedLaunchSourceOptions
  ) {
    this.#accepts = options.accepts;
    this.#isKnown = options.isKnown;
  }

  read(): Promise<EditorLaunch | undefined> {
    return Promise.resolve(this.#read());
  }

  #read(): EditorLaunch | undefined {
    let stored: string | null | undefined;
    try {
      stored = globalThis.localStorage?.getItem(
        `${LAST_OPENED_STORAGE_PREFIX}${this.#accepts}`
      );
    }
    catch {
      return undefined;
    }

    return typeof stored === "string" && this.#isKnown(stored) ?
      EditorLaunch.fromTarget(stored) :
      undefined;
  }
}
