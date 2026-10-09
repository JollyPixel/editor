// Import Internal Dependencies
import { NameSet } from "./NameSet.ts";

export class TrackPath {
  static readonly SEPARATOR = "/";

  readonly path: string;
  readonly key: string;

  constructor(
    path: string
  ) {
    this.path = path;
    this.key = path
      .split(TrackPath.SEPARATOR)
      .map(NameSet.keyOf)
      .join(TrackPath.SEPARATOR);
  }

  get blockName(): string {
    return this.path.split(TrackPath.SEPARATOR).at(-1) ?? this.path;
  }

  equals(
    other: string | TrackPath
  ): boolean {
    const path = typeof other === "string" ? new TrackPath(other) : other;

    return this.key === path.key;
  }
}
