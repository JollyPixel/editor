// Import Internal Dependencies
import type { VoxelCollider } from "../../src/collision/index.ts";
import type { VoxelObjectJSON } from "../../src/serialization/index.ts";
import type { VoxelLogger } from "../../src/utils/logger.ts";

export interface CommandSource<TCommand> {
  on(
    event: "command",
    listener: (command: TCommand) => void
  ): unknown;
}

export function recordCommands<TCommand>(
  source: CommandSource<TCommand>
): TCommand[] {
  const commands: TCommand[] = [];
  source.on("command", (command) => commands.push(command));

  return commands;
}

export function makeLogger(
  warnings: string[] = []
): VoxelLogger {
  const logger: VoxelLogger = {
    child: () => logger,
    debug: () => void 0,
    warn: (message) => void warnings.push(message),
    error: () => void 0
  };

  return logger;
}

export interface FakeCollider {
  collider: VoxelCollider;
  live: Set<string>;
  rebuilt: Parameters<VoxelCollider["rebuildChunk"]>[];
  removed: string[];
  disposeCalls: number;
}

export function makeFakeCollider(): FakeCollider {
  const fake: FakeCollider = {
    live: new Set(),
    rebuilt: [],
    removed: [],
    disposeCalls: 0,
    collider: {
      rebuildChunk(key, collision) {
        fake.live.add(key);
        fake.rebuilt.push([key, collision]);
      },
      removeChunk(key) {
        fake.live.delete(key);
        fake.removed.push(key);
      },
      dispose() {
        fake.disposeCalls++;
      }
    }
  };

  return fake;
}

export function makeObject(
  overrides: Partial<VoxelObjectJSON> = {}
): VoxelObjectJSON {
  return {
    id: "obj1",
    name: "Spawn",
    x: 0,
    y: 0,
    z: 0,
    visible: true,
    ...overrides
  };
}
