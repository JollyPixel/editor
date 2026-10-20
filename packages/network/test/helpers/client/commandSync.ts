// Import Internal Dependencies
import {
  CommandSync,
  type CommandReconciler,
  type NetworkCommandHeader,
  type NetworkServerMessage
} from "#src/index.ts";
import { RoomHarness } from "./RoomHarness.ts";

export type TestCommand = { action: "set"; value: number; } & NetworkCommandHeader;

export interface TestSnapshot {
  value: number;
}

export interface TestNotice {
  type: "rejected";
  reason: string;
}

export type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot, TestNotice>;

export function rebasingReconciler<
  TCommand extends NetworkCommandHeader
>(
  replay: (command: TCommand) => void = () => undefined
): CommandReconciler<TCommand> {
  return {
    keys: () => null,
    narrow: () => null,
    revert: () => true,
    replay: (command) => {
      replay(command);

      return true;
    }
  };
}

export function createCommandSync(
  options: { admitted: boolean; } = { admitted: true }
) {
  const harness = new RoomHarness<TestCommand, TestMessage>();
  if (options.admitted) {
    harness.admit();
  }
  const replayed: TestCommand[] = [];
  const sync = new CommandSync<TestCommand, TestSnapshot, TestNotice>(harness.room, {
    reconciler: rebasingReconciler((command) => replayed.push(command))
  });

  return {
    harness,
    sync,
    replayed
  };
}

export function remote(
  clientId: string
): TestCommand {
  return {
    action: "set",
    value: 1,
    clientId,
    seq: 1,
    timestamp: 1
  };
}
