// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  createEnvironmentFile,
  EnvironmentDocument
} from "@jolly-pixel/asset.environment/client";

// Import Internal Dependencies
import { EnvironmentEdits } from "../../src/editing/EnvironmentEdits.ts";

describe("EnvironmentEdits", () => {
  test("previews a change without storing it until it is committed", () => {
    const document = new EnvironmentDocument();
    const edits = new EnvironmentEdits(document);
    const dusk = { kind: "exp2", color: "#30203a", density: 0.04 } as const;

    edits.preview({ fog: dusk });
    assert.deepEqual(edits.file.fog, dusk);
    assert.deepEqual(document.file.fog, { kind: "none" });

    edits.commit({ fog: dusk });
    assert.deepEqual(document.file.fog, dusk);
    assert.deepEqual(edits.file, document.file);
  });

  test("drops a preview when the document resets", () => {
    const document = new EnvironmentDocument();
    const edits = new EnvironmentEdits(document);

    edits.preview({ sky: { kind: "night" } });
    document.load(createEnvironmentFile());

    assert.deepEqual(edits.file.sky, { kind: "none" });
  });
});
