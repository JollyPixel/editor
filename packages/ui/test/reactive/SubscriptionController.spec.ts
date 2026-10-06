// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  SubscriptionController
} from "../../src/reactive/SubscriptionController.ts";

interface RecordingHost extends ReactiveControllerHost {
  controllers: Array<ReactiveController>;
  updates: number;
}

interface Source {
  name: string;
}

function recordingHost(): RecordingHost {
  return {
    controllers: [],
    updates: 0,
    addController(controller) {
      this.controllers.push(controller);
    },
    removeController() {
      return undefined;
    },
    requestUpdate() {
      this.updates++;
    },
    get updateComplete() {
      return Promise.resolve(true);
    }
  };
}

function trackedSubscriber() {
  const log: Array<string> = [];

  return {
    log,
    subscribe: (source: Source) => {
      log.push(`subscribe:${source.name}`);

      return [
        () => log.push(`release:${source.name}`)
      ];
    }
  };
}

describe("SubscriptionController", () => {
  test("registers itself with its host", () => {
    const host = recordingHost();
    const controller = new SubscriptionController<Source>(host);

    assert.deepEqual(host.controllers, [controller]);
  });

  test("has no current source and throws on attached before attach", () => {
    const controller = new SubscriptionController<Source>(recordingHost());

    assert.equal(controller.current, null);
    assert.throws(
      () => controller.attached,
      { message: "No source is attached yet." }
    );
  });

  test("defers subscribing until the host connects", () => {
    const host = recordingHost();
    const { log, subscribe } = trackedSubscriber();
    const controller = new SubscriptionController(host, subscribe);
    const source = { name: "a" };

    controller.attach(source);

    assert.deepEqual(log, []);
    assert.equal(controller.attached, source);
    assert.equal(host.updates, 1);

    controller.hostConnected();

    assert.deepEqual(log, ["subscribe:a"]);
  });

  test("releases the previous source before subscribing to a new one", () => {
    const { log, subscribe } = trackedSubscriber();
    const controller = new SubscriptionController(recordingHost(), subscribe);

    controller.hostConnected();
    controller.attach({ name: "a" });
    controller.attach({ name: "b" });

    assert.deepEqual(log, [
      "subscribe:a",
      "release:a",
      "subscribe:b"
    ]);
  });

  test("releases on disconnect and resubscribes on reconnect", () => {
    const { log, subscribe } = trackedSubscriber();
    const controller = new SubscriptionController(recordingHost(), subscribe);

    controller.attach({ name: "a" });
    controller.hostConnected();
    controller.hostDisconnected();
    controller.hostConnected();

    assert.deepEqual(log, [
      "subscribe:a",
      "release:a",
      "subscribe:a"
    ]);
  });

  test("keeps the source attached across a disconnect", () => {
    const controller = new SubscriptionController<Source>(recordingHost());
    const source = { name: "a" };

    controller.attach(source);
    controller.hostConnected();
    controller.hostDisconnected();

    assert.equal(controller.current, source);
  });
});
