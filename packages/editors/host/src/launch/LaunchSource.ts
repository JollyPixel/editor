// Import Internal Dependencies
import type { EditorLaunch } from "./EditorLaunch.ts";
import { HostMessageLaunchSource } from "./HostMessageLaunchSource.ts";
import { QueryLaunchSource } from "./QueryLaunchSource.ts";
import { InjectedLaunchSource } from "./InjectedLaunchSource.ts";

export interface LaunchSource {
  read(): Promise<EditorLaunch | undefined>;
}

export function defaultLaunchSources(): LaunchSource[] {
  return [
    new HostMessageLaunchSource(),
    new QueryLaunchSource(),
    new InjectedLaunchSource()
  ];
}
