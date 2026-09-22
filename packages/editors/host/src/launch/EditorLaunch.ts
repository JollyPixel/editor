// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { LaunchNotFoundError } from "./errors/LaunchNotFoundError.ts";
import type { ShellChannel } from "./ShellChannel.ts";
import type { LaunchSource } from "./sources/LaunchSource.ts";

export class EditorLaunch {
  static parse(
    value: unknown,
    shell: ShellChannel | null = null
  ): EditorLaunch | undefined {
    if (
      typeof value !== "object" ||
      value === null ||
      !("target" in value)
    ) {
      return undefined;
    }

    return EditorLaunch.fromTarget(value.target, shell);
  }

  static fromTarget(
    target: unknown,
    shell: ShellChannel | null = null
  ): EditorLaunch | undefined {
    if (
      typeof target !== "string" ||
      target.trim() === ""
    ) {
      return undefined;
    }

    return new EditorLaunch(new AssetId(target), shell);
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
