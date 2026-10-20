// Import Internal Dependencies
import {
  EditorLaunch,
  LastOpenedLaunchSource,
  QueryLaunchSource,
  type LaunchSource
} from "../launch/index.ts";

export interface CatalogLaunchSourcesOptions {
  accepts: string;
  isKnown: (assetId: string) => boolean;
  first: () => string | undefined;
}

export function catalogLaunchSources(
  options: CatalogLaunchSourcesOptions
): LaunchSource[] {
  const { accepts, isKnown, first } = options;

  return [
    {
      read: async() => {
        const launch = await new QueryLaunchSource().read();

        return launch !== undefined && isKnown(launch.target.value) ?
          launch : undefined;
      }
    },
    new LastOpenedLaunchSource({
      accepts,
      isKnown
    }),
    {
      read: () => Promise.resolve(
        EditorLaunch.fromTarget(first())
      )
    }
  ];
}
