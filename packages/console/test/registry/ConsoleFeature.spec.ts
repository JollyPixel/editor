// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandConsole,
  registerConsoleFeatures,
  type ConsoleFeature,
  type RegistrationHandle
} from "#src/index.ts";

interface Context {
  order: string[];
}

function feature(
  name: string
): ConsoleFeature<Context> {
  return (commands, context) => {
    const namespace = commands.registerNamespace(name);

    return {
      unregister() {
        context.order.push(name);
        namespace.unregister();
      }
    };
  };
}

describe("registerConsoleFeatures", () => {
  test("registers each feature with the shared context", () => {
    const commands = new CommandConsole();
    const context = { order: [] };

    registerConsoleFeatures(
      commands,
      [feature("brush"), feature("layers")],
      context
    );

    assert.notEqual(commands.registry.namespace("brush"), undefined);
    assert.notEqual(commands.registry.namespace("layers"), undefined);
  });

  test("unregister removes the features in reverse order, once", () => {
    const commands = new CommandConsole();
    const context = { order: [] };
    const handle = registerConsoleFeatures(
      commands,
      [feature("brush"), feature("layers")],
      context
    );

    handle.unregister();
    handle.unregister();

    assert.deepEqual(context.order, ["layers", "brush"]);
    assert.equal(commands.registry.namespace("brush"), undefined);
  });

  test("a throwing feature unregisters the ones before it", () => {
    const commands = new CommandConsole();
    const context = { order: [] };
    function broken(): RegistrationHandle {
      throw new Error("broken feature");
    }

    assert.throws(
      () => registerConsoleFeatures(
        commands,
        [feature("brush"), broken],
        context
      ),
      /broken feature/
    );
    assert.deepEqual(context.order, ["brush"]);
    assert.equal(commands.registry.namespace("brush"), undefined);
  });
});
