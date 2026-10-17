// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  CommandConsole,
  type RegisteredVariable
} from "@jolly-pixel/console";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { mapConsole } from "../../src/boot/mapConsole.ts";
import { EditorState } from "../../src/state/EditorState.ts";

// CONSTANTS
const kChordKeys = "abcdefghijklmnopqrstuvwxyz";

function openConsole(
  storage: MemoryStorageAdapter
): CommandConsole {
  const commands = new CommandConsole();
  mapConsole(commands, {
    state: new EditorState({ storage })
  });

  return commands;
}

function* listVariables(
  commands: CommandConsole
): IterableIterator<RegisteredVariable> {
  for (const namespace of commands.registry.namespaces()) {
    yield* namespace.variables();
  }
}

async function change(
  variable: RegisteredVariable,
  index: number
): Promise<unknown> {
  const { def } = variable;
  switch (def.type) {
    case "boolean":
      await def.set(!def.get());
      break;
    case "number":
      await def.set(def.get() + 3);
      break;
    case "string":
      await def.set(`${def.get()}-changed`);
      break;
    case "enum": {
      const current = def.get();
      const next = def.enumValues.find((value) => value !== current);
      assert.ok(next !== undefined, `${variable.address} has a single value`);
      await def.set(next);
      break;
    }
    case "string[]":
      await def.set([`Mod+Shift+Alt+${kChordKeys[index % kChordKeys.length]}`]);
      break;
    default:
      assert.fail(`${variable.address}: no test value for "${def.type}"`);
  }

  return def.get();
}

describe("mapConsole", () => {
  test("every variable keeps its value after a reload", async() => {
    const storage = new MemoryStorageAdapter();
    const written = new Map<string, unknown>();
    const before = openConsole(storage);
    let index = 0;
    for (const variable of listVariables(before)) {
      const initial = variable.def.get();
      const value = await change(variable, index++);
      assert.notDeepEqual(value, initial, `${variable.address} did not change`);
      written.set(variable.address, value);
    }

    const after = openConsole(storage);

    assert.ok(written.size > 0);
    for (const [address, value] of written) {
      assert.deepEqual(
        after.registry.resolveVariable(address)?.def.get(),
        value,
        `${address} was not kept`
      );
    }
  });
});
