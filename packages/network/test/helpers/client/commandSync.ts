// Import Internal Dependencies
import {
  CommandSync,
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

export function createCommandSync(
  options: { admitted: boolean; } = { admitted: true }
) {
  const harness = new RoomHarness<TestCommand, TestMessage>();
  if (options.admitted) {
    harness.admit();
  }
  const sync = new CommandSync<TestCommand, TestSnapshot, TestNotice>(harness.room);

  return {
    harness,
    sync
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
