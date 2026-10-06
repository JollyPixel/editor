// Import Internal Dependencies
import {
  CopySource,
  type CopySourceRef
} from "../CopySource.ts";
import {
  PresenceSnapshot,
  type PresenceSnapshotJSON
} from "./PresenceSnapshot.ts";

// CONSTANTS
const kCopyName = "Copy";

export interface CopyPresenceJSON extends PresenceSnapshotJSON {
  copyId: string;
}

export class CopyPresence {
  static parse(
    value: unknown
  ): CopyPresence | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const copyId = Reflect.get(value, "copyId");
    const snapshot = PresenceSnapshot.parse(value);
    if (
      typeof copyId !== "string" ||
      copyId.length === 0 ||
      snapshot === null
    ) {
      return null;
    }

    return new CopyPresence(
      new CopySource(
        copyId,
        snapshot.toTemplate(`copy:${copyId}`, kCopyName)
      )
    );
  }

  readonly source: CopySource;

  constructor(
    source: CopySource
  ) {
    this.source = source;

    Object.freeze(this);
  }

  describes(
    ref: CopySourceRef
  ): boolean {
    return ref.copyId === this.source.id;
  }

  equals(
    other: CopyPresence | null
  ): boolean {
    return other !== null && (
      other.source === this.source ||
      other.source.id === this.source.id
    );
  }

  toJSON(): CopyPresenceJSON {
    return {
      copyId: this.source.id,
      ...PresenceSnapshot.of(this.source.snapshot).toJSON()
    };
  }
}
