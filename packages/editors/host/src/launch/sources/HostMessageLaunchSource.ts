// Import Internal Dependencies
import { EditorLaunch } from "../EditorLaunch.ts";
import {
  READY_MESSAGE_TYPE,
  ShellChannel,
  type ShellChannelOptions
} from "../ShellChannel.ts";
import type { LaunchSource } from "./LaunchSource.ts";

// CONSTANTS
export const LAUNCH_MESSAGE_TYPE = "jolly-launch";
const kDefaultTimeout = 1000;
const kAnyOrigin = "*";

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
      const launch = event.source === parent ?
        parseLaunchMessage(event.data, {
          port: parent,
          origin: event.origin
        }) :
        undefined;
      if (launch !== undefined) {
        resolve(launch);
      }
    }, { signal: listening.signal });
    parent.postMessage({ type: READY_MESSAGE_TYPE }, kAnyOrigin);

    return promise.finally(() => {
      clearTimeout(timer);
      listening.abort();
    });
  }
}

function parseLaunchMessage(
  data: unknown,
  shell: ShellChannelOptions
): EditorLaunch | undefined {
  if (
    typeof data !== "object" ||
    data === null ||
    !("type" in data) ||
    data.type !== LAUNCH_MESSAGE_TYPE
  ) {
    return undefined;
  }

  return EditorLaunch.parse(data, new ShellChannel(shell));
}
