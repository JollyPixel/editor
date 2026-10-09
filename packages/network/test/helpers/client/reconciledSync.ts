// Import Internal Dependencies
import {
  CommandSync,
  type CommandReconciler,
  type NetworkCommandHeader,
  type NetworkServerMessage
} from "#src/index.ts";
import { RoomHarness } from "./RoomHarness.ts";

type TestCommand = (
  | { action: "paint"; keys: string[]; value: number; }
  | { action: "move"; item: string; }
) & NetworkCommandHeader;

interface TestSnapshot {
  value: number;
}

type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot>;

interface SetupOptions {
  revertible?: boolean;
  narrows?: boolean;
  replays?: (command: TestCommand) => boolean;
}

function label(
  command: TestCommand
): string {
  return command.action === "paint" ?
    `${command.clientId}:paint:${command.keys.join("+")}=${command.value}` :
    `${command.clientId}:move:${command.item}`;
}

export function createReconciledSync(
  options: SetupOptions = {}
) {
  const {
    revertible = true,
    narrows = true,
    replays = () => true
  } = options;
  const log: string[] = [];
  const harness = new RoomHarness<TestCommand, TestMessage>();
  harness.room.join();
  harness.admit("self");
  const reconciler: CommandReconciler<TestCommand> = {
    keys: (command) => (command.action === "paint" ? command.keys : null),
    narrow: (command, keep) => {
      if (!narrows || command.action !== "paint") {
        return null;
      }

      return {
        ...command,
        keys: keep.map((index) => command.keys[index])
      };
    },
    revert: (pending) => {
      if (!revertible) {
        return false;
      }
      log.push(`revert:${pending.map((command) => command.seq).join(",")}`);

      return true;
    },
    replay: (command) => {
      log.push(`replay:${command.seq}`);

      return replays(command);
    }
  };
  const sync = new CommandSync<TestCommand, TestSnapshot>(harness.room, {
    reconciler
  });
  sync.on("command", (command) => log.push(`apply:${label(command)}`));
  sync.on("snapshot", (snapshot) => log.push(`snapshot:${snapshot.value}`));

  return {
    harness,
    sync,
    log
  };
}

export function paint(
  clientId: string,
  keys: string[],
  timestamp: number,
  value = 0
): TestCommand {
  return {
    action: "paint",
    keys,
    value,
    clientId,
    seq: 1,
    timestamp
  };
}

export function move(
  clientId: string,
  seq = 1
): TestCommand {
  return {
    action: "move",
    item: "a",
    clientId,
    seq,
    timestamp: 0
  };
}
