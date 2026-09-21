// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { FieldBinding } from "../../src/field/FieldBinding.ts";

function countingHost(): ReactiveControllerHost & { updates: number; } {
  return {
    updates: 0,
    addController() {
      return undefined;
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

function fieldEvent(
  name: string,
  value: unknown
): CustomEvent {
  return new CustomEvent(name, { detail: { value } });
}

describe("FieldBinding", () => {
  test("reads through the source on every access", () => {
    const store = { visible: true };
    const binding = new FieldBinding(countingHost(), {
      read: () => store.visible,
      write: (value) => {
        store.visible = value;
      }
    });

    assert.equal(binding.value, true);
    store.visible = false;
    assert.equal(binding.value, false);
  });

  test("commit writes the value back and requests one update", () => {
    const host = countingHost();
    const store = { visible: true };
    const binding = new FieldBinding(host, {
      read: () => store.visible,
      write: (value) => {
        store.visible = value;
      }
    });

    binding.commit(fieldEvent("jolly-change", false));

    assert.equal(store.visible, false);
    assert.equal(binding.value, false);
    assert.equal(host.updates, 1);
  });

  test("input reports last as false and commit as true", () => {
    const seen: boolean[] = [];
    const binding = new FieldBinding(countingHost(), {
      read: () => 0,
      write: (_value, last) => {
        seen.push(last);
      }
    });

    binding.input(fieldEvent("jolly-input", 1));
    binding.commit(fieldEvent("jolly-change", 2));

    assert.deepEqual(seen, [false, true]);
  });

  test("a source that refuses the write keeps the old value", () => {
    const host = countingHost();
    const store = { count: 3 };
    const binding = new FieldBinding(host, {
      read: () => store.count,
      write: (value) => {
        if (value >= 0) {
          store.count = value;
        }
      }
    });

    binding.commit(fieldEvent("jolly-change", -1));

    assert.equal(binding.value, 3);
    assert.equal(host.updates, 1);
  });

  test("an event without a detail is ignored", () => {
    const host = countingHost();
    let writes = 0;
    const binding = new FieldBinding(host, {
      read: () => 0,
      write: () => {
        writes++;
      }
    });

    binding.commit(new Event("jolly-change"));

    assert.equal(writes, 0);
    assert.equal(host.updates, 0);
  });

  test("a detail carrying no value is ignored", () => {
    const host = countingHost();
    let writes = 0;
    const binding = new FieldBinding<string>(host, {
      read: () => "",
      write: () => {
        writes++;
      }
    });

    binding.commit(
      new CustomEvent("jolly-heading-change", {
        detail: { heading: "Renamed" }
      })
    );

    assert.equal(writes, 0);
    assert.equal(host.updates, 0);
  });
});
