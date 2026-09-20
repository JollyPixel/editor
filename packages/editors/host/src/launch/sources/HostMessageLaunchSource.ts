// Import Internal Dependencies
import { EditorLaunch } from "../EditorLaunch.ts";
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

  read(): Promise<EditorLaunch | undefined> {
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
      const launch = event.source === parent ?
        parseLaunchMessage(event.data) :
        undefined;
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

function parseLaunchMessage(
  data: unknown
): EditorLaunch | undefined {
  if (
    typeof data !== "object" ||
    data === null ||
    !("type" in data) ||
    data.type !== LAUNCH_MESSAGE_TYPE
  ) {
    return undefined;
  }

  return EditorLaunch.parse(data);
}
