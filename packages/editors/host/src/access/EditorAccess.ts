// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  RoomGrants,
  type CapabilityTable,
  type GrantsRoom
} from "@jolly-pixel/network/client";
import type { Notifier } from "@jolly-pixel/ui";

// CONSTANTS
const kMaxGrantListeners = 32;
const kRefusalQuietMs = 4_000;
const kViewOnlyRefusal = "You can only view this asset, so the change was not saved";

export type EditorAccessEvents = {
  change: () => void;
};

export interface EditorAccessOptions {
  target: GrantsRoom;
  notifications: Pick<Notifier, "notify">;
}

interface TargetGrants {
  readonly current: {
    readonly readOnly: boolean;
  };
  dispose(): void;
}

export class EditorAccess extends Emitter<EditorAccessEvents> {
  readonly #targetRoom: GrantsRoom;
  readonly #notifications: Pick<Notifier, "notify">;
  #target: TargetGrants | null = null;
  #quiet: ReturnType<typeof setTimeout> | null = null;

  readonly #onDenied = (): void => {
    if (this.#quiet !== null) {
      return;
    }

    this.#quiet = setTimeout(() => {
      this.#quiet = null;
    }, kRefusalQuietMs);
    this.#notifications.notify({
      tone: "error",
      title: kViewOnlyRefusal
    });
  };

  readonly #onTargetChange = (): void => {
    this.emit("change");
  };

  constructor(
    options: EditorAccessOptions
  ) {
    super();
    this.#targetRoom = options.target;
    this.#notifications = options.notifications;
  }

  get viewOnly(): boolean {
    return this.#target?.current.readOnly ?? false;
  }

  follow<TEvent extends string, TCapability extends string>(
    room: GrantsRoom,
    table: CapabilityTable<TEvent, TCapability>
  ): RoomGrants<TEvent, TCapability> {
    const grants = new RoomGrants(room, table)
      .setMaxListeners(kMaxGrantListeners);
    grants.on("denied", this.#onDenied);

    return grants;
  }

  target<TEvent extends string, TCapability extends string>(
    table: CapabilityTable<TEvent, TCapability>
  ): RoomGrants<TEvent, TCapability> {
    if (this.#target !== null) {
      throw new Error("EditorAccess: the target grants already exist.");
    }

    const grants = this.follow(this.#targetRoom, table);
    grants.on("change", this.#onTargetChange);
    this.#target = grants;
    this.emit("change");

    return grants;
  }

  dispose(): void {
    this.#target?.dispose();
    this.#target = null;
    if (this.#quiet !== null) {
      clearTimeout(this.#quiet);
      this.#quiet = null;
    }
  }
}
