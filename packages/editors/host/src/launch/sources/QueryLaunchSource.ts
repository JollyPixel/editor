// Import Internal Dependencies
import { EditorLaunch } from "../EditorLaunch.ts";
import type { LaunchSource } from "./LaunchSource.ts";

// CONSTANTS
export const LAUNCH_QUERY_PARAM = "target";

export class QueryLaunchSource implements LaunchSource {
  readonly param: string;

  constructor(
    param: string = LAUNCH_QUERY_PARAM
  ) {
    this.param = param;
  }

  read(): Promise<EditorLaunch | undefined> {
    const target = new URLSearchParams(
      location.search
    ).get(this.param);

    return Promise.resolve(
      EditorLaunch.fromTarget(target)
    );
  }
}
