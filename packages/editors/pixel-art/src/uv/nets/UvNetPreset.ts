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

export interface UvNetPresetJSON {
  id: string;
  name: string;
  rows: readonly UVNetRow[] | null;
}

export class UvNetPreset {
  readonly id: string;
  readonly name: string;
  readonly net: UVNet;
  readonly locked: boolean;

  constructor(
    init: UvNetPresetInit,
    locked = false
  ) {
    this.id = init.id;
    this.name = init.name;
    this.net = init.rows === null ? UVNet.packed : new UVNet(init.rows);
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

  with(
    changes: Partial<Omit<UvNetPresetInit, "id">>
  ): UvNetPreset {
    return new UvNetPreset({
      id: this.id,
      name: changes.name ?? this.name,
      rows: changes.rows === undefined ? this.rows : changes.rows
    }, this.locked);
  }

  toJSON(): UvNetPresetJSON {
    return {
      id: this.id,
      name: this.name,
      rows: this.rows
    };
  }
}
