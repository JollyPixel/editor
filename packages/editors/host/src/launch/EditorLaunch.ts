// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { LaunchNotFoundError } from "./errors/LaunchNotFoundError.ts";
import type { LaunchSource } from "./sources/LaunchSource.ts";

export class EditorLaunch {
  static parse(
    value: unknown
  ): EditorLaunch | undefined {
    if (
      typeof value !== "object" ||
      value === null ||
      !("target" in value)
    ) {
      return undefined;
    }

    return EditorLaunch.fromTarget(value.target);
  }

  static fromTarget(
    target: unknown
  ): EditorLaunch | undefined {
    if (
      typeof target !== "string" ||
      target.trim() === ""
    ) {
      return undefined;
    }

    return new EditorLaunch(new AssetId(target));
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

  constructor(
    target: AssetId
  ) {
    this.target = target;
  }
}
