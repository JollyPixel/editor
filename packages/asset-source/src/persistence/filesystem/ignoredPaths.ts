// Import Third-party Dependencies
import picomatch from "picomatch";

// Import Internal Dependencies
import { STATE_DIRECTORY } from "../../constants.ts";

export const DEFAULT_IGNORED_PATHS: readonly string[] = [
  `${STATE_DIRECTORY}/**`,
  ".git/**",
  "node_modules/**",
  "dist/**"
];

export type AssetPathMatcher = (assetPath: string) => boolean;

export function createIgnoredPathMatcher(
  ignore: readonly string[]
): AssetPathMatcher {
  return picomatch(
    [
      ...DEFAULT_IGNORED_PATHS,
      ...ignore
    ],
    {
      dot: true,
      nocase: true
    }
  );
}
