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
import { TestEnvironmentAccess } from "../helpers/environmentAccess.ts";

// CONSTANTS
const kDusk = { kind: "exp2", color: "#30203a", density: 0.04 } as const;

describe("EnvironmentEdits", () => {
  test("previews a change without storing it until it is committed", () => {
    const document = new EnvironmentDocument();
    const edits = new EnvironmentEdits(document, new TestEnvironmentAccess());

    edits.preview({ fog: kDusk });
    assert.deepEqual(edits.file.fog, kDusk);
    assert.deepEqual(document.file.fog, { kind: "none" });

    edits.commit({ fog: kDusk });
    assert.deepEqual(document.file.fog, kDusk);
    assert.deepEqual(edits.file, document.file);
  });

  test("drops a preview when the document resets", () => {
    const document = new EnvironmentDocument();
    const edits = new EnvironmentEdits(document, new TestEnvironmentAccess());

    edits.preview({ sky: { kind: "night" } });
    document.load(createEnvironmentFile());

    assert.deepEqual(edits.file.sky, { kind: "none" });
  });

  test("neither previews nor stores a change without \"settings\", then stores it with it", () => {
    const document = new EnvironmentDocument();
    const access = new TestEnvironmentAccess();
    const edits = new EnvironmentEdits(document, access);

    access.viewOnly();
    edits.preview({ fog: kDusk });
    edits.commit({ fog: kDusk });

    assert.deepEqual(edits.file.fog, { kind: "none" });
    assert.deepEqual(document.file.fog, { kind: "none" });

    access.grant("settings");
    edits.commit({ fog: kDusk });

    assert.deepEqual(document.file.fog, kDusk);
  });

  test("drops a running preview when the member loses \"settings\"", () => {
    const access = new TestEnvironmentAccess();
    const edits = new EnvironmentEdits(new EnvironmentDocument(), access);
    edits.preview({ fog: kDusk });

    access.viewOnly();

    assert.deepEqual(edits.file.fog, { kind: "none" });
  });
});
