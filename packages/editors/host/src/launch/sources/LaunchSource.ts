// Import Internal Dependencies
import type { EditorLaunch } from "../EditorLaunch.ts";

export interface LaunchSource {
  read(): Promise<EditorLaunch | undefined>;
}
