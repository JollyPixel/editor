// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import * as z from "zod";

// Import Internal Dependencies
import { LaunchNotFoundError } from "./errors/LaunchNotFoundError.ts";
import type { ShellChannel } from "./ShellChannel.ts";
import type { LaunchSource } from "./sources/LaunchSource.ts";

// CONSTANTS
const kTargetSchema = z.string().refine(
  (target) => target.trim() !== ""
);
const kLaunchSchema = z.object({
  target: kTargetSchema
});

export class EditorLaunch {
  static parse(
    value: unknown,
    shell: ShellChannel | null = null
  ): EditorLaunch | undefined {
    const parsed = kLaunchSchema.safeParse(value);

    return parsed.success ?
      new EditorLaunch(new AssetId(parsed.data.target), shell) :
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

  static async read(
    sources: Iterable<LaunchSource>
  ): Promise<EditorLaunch> {
    for (const source of sources) {
      const launch = await source.read();
      if (launch !== undefined) {
        return launch;
      }
    }

    throw new LaunchNotFoundError();
  }

  readonly target: AssetId;
  readonly shell: ShellChannel | null;

  constructor(
    target: AssetId,
    shell: ShellChannel | null = null
  ) {
    this.target = target;
    this.shell = shell;
  }
}
