// Import Third-party Dependencies
import { NameSet } from "@jolly-pixel/asset.common";

export class TrackPath {
  static readonly SEPARATOR = "/";

  static findRepeated(
    paths: Iterable<string>
  ): string | undefined {
    const keys = new Set<string>();
    for (const path of paths) {
      const { key } = new TrackPath(path);
      if (keys.has(key)) {
        return path;
      }
      keys.add(key);
    }

    return undefined;
  }

  readonly path: string;
  readonly key: string;

  constructor(
    path: string
  ) {
    this.path = path;
    this.key = path
      .split(TrackPath.SEPARATOR)
      .map(NameSet.toKey)
      .join(TrackPath.SEPARATOR);
  }

  get blockName(): string {
    return this.path.split(TrackPath.SEPARATOR).at(-1) ?? this.path;
  }

  equals(
    other: string
  ): boolean {
    return this.key === new TrackPath(other).key;
  }
}
