// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { Validator } from "ata-validator";

// Import Internal Dependencies
import {
  clientEnvelopeSchema,
  serverEnvelopeSchema
} from "#src/protocol/Envelope.schema.ts";
import * as clientValidator from "#src/protocol/generated/client.compiled.ts";
import * as serverValidator from "#src/protocol/generated/server.compiled.ts";
import { compileAll } from "../../scripts/compileSchemas.ts";

// CONSTANTS
const kGeneratedDir = path.join(
  import.meta.dirname,
  "..",
  "..",
  "src",
  "protocol",
  "generated"
);
const kValidatorOptions = { useDefaults: false };
const kCorpus: readonly unknown[] = [
  null,
  42,
  "envelope",
  [],
  {},
  { room: "lobby" },
  { room: "lobby", kind: "leave" },
  { room: 42, kind: "leave" },
  { room: "lobby", kind: "join" },
  { room: "lobby", kind: "join", identity: {} },
  { room: "lobby", kind: "join", identity: { role: "editor" } },
  { room: "lobby", kind: "join", identity: [] },
  { room: "lobby", kind: "join", identity: "editor" },
  { room: "lobby", kind: "message" },
  { room: "lobby", kind: "message", payload: null },
  { room: "lobby", kind: "message", payload: { action: "voxel-set" } },
  { room: "lobby", kind: "presence" },
  { room: "lobby", kind: "presence", patch: {} },
  { room: "lobby", kind: "presence", patch: 3 },
  { room: "lobby", kind: "sync" },
  { room: "lobby", kind: "sync", members: [] },
  {
    room: "lobby",
    kind: "sync",
    members: [{ clientId: "A", identity: {}, presence: {} }]
  },
  { room: "lobby", kind: "sync", members: [{ clientId: "A" }] },
  { room: "lobby", kind: "sync", members: {} },
  { room: "lobby", kind: "peer-joined", clientId: "A", identity: {} },
  { room: "lobby", kind: "peer-joined", clientId: 42, identity: {} },
  { room: "lobby", kind: "peer-left", clientId: "A" },
  { room: "lobby", kind: "peer-presence", clientId: "A", patch: {} },
  { room: "lobby", kind: "denied", event: "$join", reason: "nope" },
  { room: "lobby", kind: "denied", event: "$join" },
  { room: "lobby", kind: "error", event: "voxel-set", reason: "disk full" },
  { room: "lobby", kind: "unknown-kind" }
];

describe("compiled envelope validators", () => {
  test("the checked-in modules match the schemas they are generated from", async() => {
    for (const [fileName, expected] of compileAll()) {
      const actual = await fs.readFile(
        path.join(kGeneratedDir, fileName),
        "utf8"
      );

      assert.equal(
        actual.replace(/\r\n/g, "\n"),
        expected,
        `${fileName} is stale, run "npm run build:schemas"`
      );
    }
  });

  test("agree with a runtime Validator built from the same schema", () => {
    const pairs = [
      {
        name: "client",
        runtime: new Validator(clientEnvelopeSchema, kValidatorOptions),
        compiled: clientValidator
      },
      {
        name: "server",
        runtime: new Validator(serverEnvelopeSchema, kValidatorOptions),
        compiled: serverValidator
      }
    ];

    for (const { name, runtime, compiled } of pairs) {
      for (const value of kCorpus) {
        assert.equal(
          compiled.isValid(value),
          runtime.validate(value).valid,
          `${name} disagreed on ${JSON.stringify(value)}`
        );
      }
    }
  });
});
