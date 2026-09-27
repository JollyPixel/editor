// Import Third-party Dependencies
import { expect, test } from "tstyche";

// Import Internal Dependencies
import {
  runMeshWorker,
  type MeshWorkerOptions,
  type MeshWorkerPort,
  type MeshWorkerScope
} from "../../../src/index.ts";

test("a browser Worker is a mesh worker port", () => {
  expect<Worker>().type.toBeAssignableTo<MeshWorkerPort>();
  expect<MeshWorkerOptions>().type.toBeAssignableFrom({
    createWorker: () => new Worker("mesh.js", { type: "module" })
  });
});

test("a worker global scope or message port serves a mesh worker", () => {
  expect<typeof self>().type.toBeAssignableTo<MeshWorkerScope>();
  expect<MessagePort>().type.toBeAssignableTo<MeshWorkerScope>();
  expect(runMeshWorker).type.not.toBeCallableWith({});
});
