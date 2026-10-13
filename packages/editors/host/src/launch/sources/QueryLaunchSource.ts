// Import Internal Dependencies
import {
  EditorLaunch,
  LAUNCH_QUERY_PARAM
} from "../EditorLaunch.ts";
import type { LaunchSource } from "./LaunchSource.ts";

export class QueryLaunchSource implements LaunchSource {
  readonly param: string;

  constructor(
    param: string = LAUNCH_QUERY_PARAM
  ) {
    this.param = param;
  }

  read(): Promise<EditorLaunch | undefined> {
    return Promise.resolve(
      this.peek()
    );
  }

  peek(): EditorLaunch | undefined {
    return EditorLaunch.fromUrl(
      new URL(location.href),
      this.param
    );
  }
}
