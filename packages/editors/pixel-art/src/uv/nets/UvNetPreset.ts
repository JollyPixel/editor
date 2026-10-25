// Import Third-party Dependencies
import {
  UVNet,
  type UVNetCellInput,
  type UVNetRow,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

export type UvNetRowsInput = Iterable<Iterable<UVNetCellInput>>;

export interface UvNetPresetInit {
  id: string;
  name: string;
  rows: UvNetRowsInput | null;
}

export class UvNetPreset {
  static locked(
    init: UvNetPresetInit
  ): UvNetPreset {
    return new UvNetPreset({
      id: init.id,
      name: init.name,
      net: init.rows === null ? UVNet.packed : new UVNet(init.rows)
    }, true);
  }

  readonly id: string;
  readonly name: string;
  readonly net: UVNet;
  readonly locked: boolean;

  constructor(
    source: Pick<UvNetPreset, "id" | "name" | "net">,
    locked = false
  ) {
    this.id = source.id;
    this.name = source.name;
    this.net = source.net;
    this.locked = locked;

    Object.freeze(this);
  }

  get rows(): readonly UVNetRow[] | null {
    return this.net.rows;
  }

  fits(
    slots: Iterable<UVSlot>
  ): boolean {
    return this.net.missingSlots(slots).length === 0;
  }
}
