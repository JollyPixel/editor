// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  restTarget,
  TransformTool,
  type TransformTarget
} from "#src/features/transform/TransformTool.ts";
import { createModelFixture } from "../../fixtures/model.ts";
import { modelAccess } from "../../fixtures/modelAccess.ts";

function target(
  modes: TransformTarget["modes"]
): TransformTarget {
  return {
    modes,
    writable: true,
    end: () => undefined,
    commit: () => undefined
  };
}

describe("TransformTool", () => {
  test("reads a mode the target does not edit as its first, and remembers it for later", () => {
    const build = target(["pos", "size", "scale"]);
    const animate = target(["pos", "scale"]);
    const tool = new TransformTool(build);
    let changes = 0;
    tool.on("change", () => changes++);

    tool.mode = "size";
    tool.use(animate);
    assert.equal(tool.mode, "pos");
    tool.mode = "size";
    assert.equal(tool.mode, "pos");

    tool.use(build);
    assert.equal(tool.mode, "size");
    assert.equal(changes, 3);
  });

  test("the rest target locks a drag and commits it to the model", () => {
    const calls: string[] = [];
    const rest = restTarget({
      blocks: { commitTransform: (uuid) => calls.push(`commit ${uuid}`) },
      lock: {
        claim: (uuid) => calls.push(`claim ${uuid}`),
        release: () => calls.push("release")
      },
      access: modelAccess()
    });
    const block = createModelFixture().addBlock();
    const { uuid } = block;

    rest.begin?.(block);
    rest.end(block);
    rest.commit(block);

    assert.deepEqual(calls, [
      `claim ${uuid}`,
      `commit ${uuid}`,
      "release",
      `commit ${uuid}`
    ]);
  });

  test("the rest target without transform rights is read only and still releases a drag's lock", () => {
    const calls: string[] = [];
    const access = modelAccess();
    const rest = restTarget({
      blocks: { commitTransform: (uuid) => calls.push(`commit ${uuid}`) },
      lock: {
        claim: (uuid) => calls.push(`claim ${uuid}`),
        release: () => calls.push("release")
      },
      access
    });
    const block = createModelFixture().addBlock();
    access.grant("hierarchy");

    rest.end(block);
    rest.commit(block);

    assert.deepEqual([rest.writable, calls], [false, ["release"]]);
  });
});
