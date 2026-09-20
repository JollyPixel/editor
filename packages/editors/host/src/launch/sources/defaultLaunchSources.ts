// Import Internal Dependencies
import { HostMessageLaunchSource } from "./HostMessageLaunchSource.ts";
import { InjectedLaunchSource } from "./InjectedLaunchSource.ts";
import type { LaunchSource } from "./LaunchSource.ts";
import { QueryLaunchSource } from "./QueryLaunchSource.ts";

export function defaultLaunchSources(): LaunchSource[] {
  return [
    new HostMessageLaunchSource(),
    new QueryLaunchSource(),
    new InjectedLaunchSource()
  ];
}
