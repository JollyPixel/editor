// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";
import { LaunchNotFoundError } from "./errors/LaunchNotFoundError.ts";
import type { ShellChannel } from "./ShellChannel.ts";
import type { LaunchSource } from "./sources/LaunchSource.ts";

// CONSTANTS
export const LAUNCH_QUERY_PARAM = "target";
export const LAUNCH_TAG_PARAM = "tag";
const kTargetSchema = z.string().check(
  z.refine((target) => target.trim() !== "")
);
const kLaunchSchema = z.object({
  target: kTargetSchema,
  credential: z.optional(z.string().check(z.minLength(1)))
});

export class EditorLaunch {
  static parse(
    value: unknown,
    shell: ShellChannel | null = null
  ): EditorLaunch | undefined {
    const parsed = kLaunchSchema.safeParse(value);

    return parsed.success ?
      new EditorLaunch(
        new AssetId(parsed.data.target),
        shell,
        parsed.data.credential ?? null
      ) :
      undefined;
  }

  static fromTarget(
    target: unknown,
    shell: ShellChannel | null = null
  ): EditorLaunch | undefined {
    const parsed = kTargetSchema.safeParse(target);

    return parsed.success ?
      new EditorLaunch(new AssetId(parsed.data), shell) :
      undefined;
  }

  static fromUrl(
    url: URL,
    param: string = LAUNCH_QUERY_PARAM
  ): EditorLaunch | undefined {
    const tag = url.searchParams.get(LAUNCH_TAG_PARAM)?.trim();

    return EditorLaunch.fromTarget(
      url.searchParams.get(param)
    )?.viewing(tag ? tag : null);
  }

  static async read(
    sources: Iterable<LaunchSource>,
    logger?: HostLogger
  ): Promise<EditorLaunch> {
    const launch = await EditorLaunch.first(
      sources,
      logger
    );
    if (launch === undefined) {
      throw new LaunchNotFoundError();
    }

    return launch;
  }

  static async first(
    sources: Iterable<LaunchSource>,
    logger?: HostLogger
  ): Promise<EditorLaunch | undefined> {
    let index = 0;
    for (const source of sources) {
      const launch = await source.read();
      logger?.debug("launch source read", {
        index,
        source: source.constructor.name,
        target: launch?.target.value ?? null
      });
      if (launch !== undefined) {
        return launch;
      }
      index++;
    }

    return undefined;
  }

  readonly target: AssetId;
  readonly shell: ShellChannel | null;
  readonly credential: string | null;
  readonly tag: string | null;

  constructor(
    target: AssetId,
    shell: ShellChannel | null = null,
    credential: string | null = null,
    tag: string | null = null
  ) {
    this.target = target;
    this.shell = shell;
    this.credential = credential;
    this.tag = tag;
  }

  sameView(
    other: EditorLaunch
  ): boolean {
    return this.target.equals(
      other.target
    ) && this.tag === other.tag;
  }

  toUrl(
    href: string
  ): URL {
    const url = new URL(href);
    url.searchParams.set(
      LAUNCH_QUERY_PARAM,
      this.target.value
    );
    if (this.tag === null) {
      url.searchParams.delete(LAUNCH_TAG_PARAM);
    }
    else {
      url.searchParams.set(
        LAUNCH_TAG_PARAM,
        this.tag
      );
    }

    return url;
  }

  retarget(
    target: string,
    tag: string | null = null
  ): EditorLaunch {
    return new EditorLaunch(
      new AssetId(target),
      this.shell,
      this.credential,
      tag
    );
  }

  viewing(
    tag: string | null
  ): EditorLaunch {
    return new EditorLaunch(
      this.target,
      this.shell,
      this.credential,
      tag
    );
  }
}
