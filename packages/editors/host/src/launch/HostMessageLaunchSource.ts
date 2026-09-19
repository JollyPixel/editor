// Import Internal Dependencies
import { EditorLaunch } from "./EditorLaunch.ts";
import type { LaunchSource } from "./LaunchSource.ts";

// CONSTANTS
export const LAUNCH_MESSAGE_TYPE = "jolly-launch";
const kDefaultTimeout = 1000;

export interface HostMessageLaunchSourceOptions {
  timeout?: number;
}

export class HostMessageLaunchSource implements LaunchSource {
  readonly timeout: number;

  constructor(
    options: HostMessageLaunchSourceOptions = {}
  ) {
    this.timeout = options.timeout ?? kDefaultTimeout;
  }

  async read(): Promise<EditorLaunch | undefined> {
    const { parent } = window;
    if (parent === null || parent === window) {
      return Promise.resolve(undefined);
    }

    const { promise, resolve } = Promise.withResolvers<EditorLaunch | undefined>();
    const listening = new AbortController();
    const timer = setTimeout(
      () => resolve(undefined),
      this.timeout
    );

    window.addEventListener("message", (event) => {
      if (
        event.source !== parent ||
        event.data?.type !== LAUNCH_MESSAGE_TYPE
      ) {
        return;
      }

      const launch = EditorLaunch.parse(event.data);
      if (launch !== undefined) {
        resolve(launch);
      }
    }, { signal: listening.signal });

    return promise.finally(() => {
      clearTimeout(timer);
      listening.abort();
    });
  }
}
