// Import Third-party Dependencies
import * as z from "zod";

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
const kLaunchMessageSchema = z.object({
  type: z.literal(LAUNCH_MESSAGE_TYPE)
});

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
  if (!kLaunchMessageSchema.safeParse(data).success) {
    return undefined;
  }

  return EditorLaunch.parse(data, new ShellChannel(shell));
}
