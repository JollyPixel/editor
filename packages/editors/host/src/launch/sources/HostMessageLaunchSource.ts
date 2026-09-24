// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { HostLogger } from "../../debug/readDebugLogger.ts";
import { EditorLaunch } from "../EditorLaunch.ts";
import {
  READY_MESSAGE_TYPE,
  ShellChannel
} from "../ShellChannel.ts";
import type { LaunchSource } from "./LaunchSource.ts";

// CONSTANTS
export const LAUNCH_MESSAGE_TYPE = "jolly-launch";
export const ANY_SHELL_ORIGIN = "*";
const kDefaultTimeout = 1000;
const kLaunchMessageSchema = z.object({
  type: z.literal(LAUNCH_MESSAGE_TYPE)
});

export interface HostMessageLaunchSourceOptions {
  timeout?: number;
  /**
   * Origins allowed to launch the page. `ANY_SHELL_ORIGIN` allows every
   * origin.
   * @default [location.origin]
   */
  origins?: Iterable<string>;
  logger?: HostLogger;
}

export class HostMessageLaunchSource implements LaunchSource {
  readonly timeout: number;
  readonly origins: ReadonlySet<string>;

  #logger: HostLogger | undefined;

  constructor(
    options: HostMessageLaunchSourceOptions = {}
  ) {
    this.timeout = options.timeout ?? kDefaultTimeout;
    this.origins = new Set(
      options.origins ?? [location.origin]
    );
    this.#logger = options.logger;
  }

  allows(
    origin: string
  ): boolean {
    return this.origins.has(ANY_SHELL_ORIGIN) || this.origins.has(origin);
  }

  async read(): Promise<EditorLaunch | undefined> {
    const { parent } = window;
    if (
      parent === null ||
      parent === window
    ) {
      return Promise.resolve(undefined);
    }

    const {
      promise,
      resolve
    } = Promise.withResolvers<EditorLaunch | undefined>();
    const listening = new AbortController();
    const timer = setTimeout(
      () => {
        this.#logger?.warn("launch timed out", {
          timeout: this.timeout
        });
        resolve(undefined);
      },
      this.timeout
    );

    window.addEventListener("message", (event) => {
      if (
        event.source !== parent ||
        !kLaunchMessageSchema.safeParse(event.data).success
      ) {
        return;
      }
      if (!this.allows(event.origin)) {
        this.#logger?.warn("launch rejected", {
          origin: event.origin
        });

        return;
      }

      const launch = EditorLaunch.parse(
        event.data,
        new ShellChannel({
          port: parent,
          origin: event.origin
        })
      );
      if (launch !== undefined) {
        this.#logger?.debug("launch accepted", {
          origin: event.origin,
          target: launch.target.value
        });
        resolve(launch);
      }
    }, { signal: listening.signal });
    for (const origin of this.origins) {
      parent.postMessage(
        { type: READY_MESSAGE_TYPE },
        origin
      );
    }
    this.#logger?.debug("ready posted", {
      origins: [...this.origins]
    });

    return promise.finally(() => {
      clearTimeout(timer);
      listening.abort();
    });
  }
}
