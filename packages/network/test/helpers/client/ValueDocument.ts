// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type {
  NetworkCommandHeader,
  NetworkServerMessage
} from "#src/client/index.ts";

export interface SetCommand {
  action: "set";
  value: number;
}

export type TestCommand = SetCommand & NetworkCommandHeader;

export interface TestSnapshot {
  value: number;
}

export type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot>;

export class ValueDocument extends CommandDocument<SetCommand, TestSnapshot, number> {
  readonly changes: CommandChange<SetCommand, number>[] = [];
  readonly loads: number[];
  #state: { value: number; };

  constructor() {
    const state = { value: 0 };
    const loads: number[] = [];
    super({
      accepts: () => true,
      placeable: (command) => command,
      apply: ({ value }) => {
        state.value = value;
      },
      load: ({ value }) => {
        loads.push(value);
        state.value = value;
      },
      captureImage: () => state.value,
      invert: () => [{ action: "set", value: state.value }],
      restored: (images) => {
        return { value: images[0] };
      }
    });
    this.#state = state;
    this.loads = loads;
    this.subscribe("change", (change) => this.changes.push(change));
  }

  get value(): number {
    return this.#state.value;
  }

  set(
    value: number
  ): void {
    this.commit({ action: "set", value });
  }
}
