// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange
} from "@jolly-pixel/network/client";
import {
  holdsSurfacePatch,
  isMaterialSurfacePatch,
  type MaterialSurfacePatchJSON,
  type ModelChange,
  type ModelDocument,
  type VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  MaterialPreviews,
  PreviewOwner
} from "../../../state/index.ts";
import { PRESENCE_KEYS } from "../../../collaboration/presenceKeys.ts";
import { LatestFrameThrottle } from "../../../collaboration/LatestFrameThrottle.ts";

// CONSTANTS
const kThrottleMs = 50;
const kSettleTimeoutMs = 3000;

export interface MaterialLiveSyncOptions {
  room: VoxelModelRoom;
  document: ModelDocument;
  previews: MaterialPreviews;
}

interface MaterialLiveFrame {
  materialId: string;
  changes: MaterialSurfacePatchJSON;
  /** The stream ended on fields a command writes; they stay until it lands. */
  saved?: true;
}

export class MaterialLiveSync {
  #document: ModelDocument;
  #previews: MaterialPreviews;
  #channel: PresenceChannel<MaterialLiveFrame | null>;
  #streams = new Map<string, MaterialLiveFrame>();
  #settling = new Map<string, ReturnType<typeof setTimeout>>();
  #local: MaterialLiveFrame | null = null;
  #throttle: LatestFrameThrottle<MaterialLiveFrame>;
  #subscriptions: Array<() => void>;

  #onPreviewChange = (
    materialId: string,
    owner: PreviewOwner
  ): void => {
    if (owner !== null) {
      return;
    }

    const changes = this.#previews.layer(materialId, null);
    if (changes !== undefined) {
      this.#local = {
        materialId,
        changes
      };
      this.#throttle.push(this.#local);
    }
    else if (this.#local?.materialId === materialId) {
      this.#endLocal(this.#local);
    }
  };

  #onPeerFrame = (
    change: PresenceChange<MaterialLiveFrame | null>
  ): void => {
    const { clientId, value } = change;
    this.#endStream(clientId);
    if (value) {
      this.#streams.set(clientId, value);
      this.#previews.set(value.materialId, clientId, value.changes);
      if (value.saved) {
        this.#settle(clientId);
      }
    }
  };

  #onChange = (
    change: ModelChange
  ): void => {
    const { command } = change;
    if (command.action !== "material-changed") {
      return;
    }

    for (const clientId of [...this.#settling.keys()]) {
      if (this.#streams.get(clientId)?.materialId === command.id) {
        this.#settle(clientId);
      }
    }
  };

  constructor(
    options: MaterialLiveSyncOptions
  ) {
    this.#document = options.document;
    this.#previews = options.previews;
    this.#channel = new PresenceChannel<MaterialLiveFrame | null>(options.room, {
      key: PRESENCE_KEYS.materialLive,
      decode: decodeLiveFrame,
      equals: () => false
    });
    this.#throttle = new LatestFrameThrottle(
      kThrottleMs,
      (frame) => this.#channel.publish(frame)
    );
    this.#subscriptions = [
      this.#channel.subscribe("change", this.#onPeerFrame),
      this.#previews.subscribe("change", this.#onPreviewChange),
      this.#document.subscribe("change", this.#onChange)
    ];
  }

  dispose(): void {
    this.#throttle.cancel();
    for (const unsubscribe of this.#subscriptions) {
      unsubscribe();
    }
    for (const clientId of [...this.#streams.keys()]) {
      this.#endStream(clientId);
    }
    this.#channel.destroy();
  }

  #endLocal(
    frame: MaterialLiveFrame
  ): void {
    this.#local = null;
    this.#throttle.cancel();

    const stored = this.#document.tree.materials.material(frame.materialId)?.surface;
    this.#channel.publish(
      stored !== undefined && holdsSurfacePatch(stored, frame.changes) ?
        {
          ...frame,
          saved: true
        } :
        null
    );
  }

  #settle(
    clientId: string
  ): void {
    const stream = this.#streams.get(clientId);
    if (stream === undefined) {
      return;
    }

    const stored = this.#document.tree.materials.material(stream.materialId)?.surface;
    if (stored === undefined || holdsSurfacePatch(stored, stream.changes)) {
      this.#endStream(clientId);
    }
    else if (!this.#settling.has(clientId)) {
      this.#settling.set(clientId, setTimeout(
        () => this.#endStream(clientId),
        kSettleTimeoutMs
      ));
    }
  }

  #endStream(
    clientId: string
  ): void {
    clearTimeout(this.#settling.get(clientId));
    this.#settling.delete(clientId);

    const stream = this.#streams.get(clientId);
    if (stream !== undefined) {
      this.#streams.delete(clientId);
      this.#previews.end(stream.materialId, clientId);
    }
  }
}

function decodeLiveFrame(
  value: unknown
): MaterialLiveFrame | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const materialId: unknown = Reflect.get(value, "materialId");
  const changes: unknown = Reflect.get(value, "changes");
  if (typeof materialId !== "string" || !isMaterialSurfacePatch(changes)) {
    return undefined;
  }

  return Reflect.get(value, "saved") === true ?
    {
      materialId,
      changes,
      saved: true
    } :
    {
      materialId,
      changes
    };
}
