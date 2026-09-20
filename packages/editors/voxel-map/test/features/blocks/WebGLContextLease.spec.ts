// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  WebGLContextLease,
  type LeasedWebGLRenderer
} from "../../../src/features/blocks/WebGLContextLease.ts";

// CONSTANTS
const kContextLostEvent = "webglcontextlost";

interface FakeRenderer extends LeasedWebGLRenderer {
  calls: string[];
}

function fakeRenderer(): FakeRenderer {
  const calls: string[] = [];

  return {
    calls,
    domElement: new EventTarget(),
    forceContextLoss: () => {
      calls.push("forceContextLoss");
    },
    dispose: () => {
      calls.push("dispose");
    }
  };
}

describe("WebGLContextLease", () => {
  it("reports a context lost by the browser", () => {
    const renderer = fakeRenderer();
    const lease = new WebGLContextLease(renderer);
    let lost = 0;
    lease.onLost = () => {
      lost++;
    };

    renderer.domElement.dispatchEvent(new Event(kContextLostEvent));

    assert.equal(lost, 1);
  });

  it("frees the context before disposing the renderer", () => {
    const renderer = fakeRenderer();
    const lease = new WebGLContextLease(renderer);

    lease.release();

    assert.deepEqual(renderer.calls, ["forceContextLoss", "dispose"]);
  });

  it("stays silent about the loss it forces on release", () => {
    const renderer = fakeRenderer();
    const lease = new WebGLContextLease(renderer);
    let lost = 0;
    lease.onLost = () => {
      lost++;
    };

    lease.release();
    renderer.domElement.dispatchEvent(new Event(kContextLostEvent));

    assert.equal(lost, 0);
  });

  it("releases only once", () => {
    const renderer = fakeRenderer();
    const lease = new WebGLContextLease(renderer);

    lease.release();
    lease.release();

    assert.deepEqual(renderer.calls, ["forceContextLoss", "dispose"]);
  });
});
