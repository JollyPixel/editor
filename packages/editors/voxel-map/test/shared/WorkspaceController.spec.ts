// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../src/scene/EditorScene.ts";
import { WorkspaceController } from "../../src/shared/WorkspaceController.ts";

// CONSTANTS
const kWorkspace = {} as VoxelMapWorkspace;

class FakeHost implements ReactiveControllerHost {
  updates = 0;
  updateComplete = Promise.resolve(true);

  addController(): void {
    return void 0;
  }

  removeController(): void {
    return void 0;
  }

  requestUpdate(): void {
    this.updates++;
  }
}

function setup() {
  const host = new FakeHost();
  const log: string[] = [];
  const controller = new WorkspaceController(host, () => {
    log.push("subscribe");

    return [() => log.push("release")];
  });

  return { host, log, controller };
}

describe("WorkspaceController", () => {
  it("refuses to hand out a workspace before one is attached", () => {
    const { controller } = setup();

    assert.equal(controller.current, null);
    assert.throws(() => controller.attached, /No workspace/);
  });

  it("waits for the host to connect before subscribing", () => {
    const { host, log, controller } = setup();

    controller.attach(kWorkspace);
    assert.deepEqual(log, []);
    assert.equal(host.updates, 1);
    assert.equal(controller.attached, kWorkspace);

    controller.hostConnected();
    assert.deepEqual(log, ["subscribe"]);
  });

  it("subscribes on attach when the host is already connected", () => {
    const { log, controller } = setup();

    controller.hostConnected();
    assert.deepEqual(log, []);

    controller.attach(kWorkspace);
    assert.deepEqual(log, ["subscribe"]);
  });

  it("releases on disconnect and subscribes again on reconnect", () => {
    const { log, controller } = setup();

    controller.hostConnected();
    controller.attach(kWorkspace);
    controller.hostDisconnected();
    controller.hostConnected();

    assert.deepEqual(log, ["subscribe", "release", "subscribe"]);
  });
});
