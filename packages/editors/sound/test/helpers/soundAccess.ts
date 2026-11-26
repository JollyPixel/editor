// Import Third-party Dependencies
import type { SoundCommand } from "@jolly-pixel/asset.sound/client";
import {
  Grants,
  type RoomGrantsEventMap
} from "@jolly-pixel/network/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  SOUND_CAPABILITY_TABLE,
  type SoundCapability
} from "#src/access/SoundAccess.ts";

export class TestSoundAccess extends Emitter<
  RoomGrantsEventMap<SoundCommand["action"], SoundCapability>
> {
  current: Grants<SoundCapability> = SOUND_CAPABILITY_TABLE.full;

  grant(
    ...capabilities: [SoundCapability, ...SoundCapability[]]
  ): void {
    this.#set(capabilities);
  }

  viewOnly(): void {
    this.#set([]);
  }

  #set(
    capabilities: Iterable<SoundCapability>
  ): void {
    this.current = new Grants(capabilities);
    this.emit("change", this.current);
  }
}
