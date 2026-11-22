// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SignalEvent } from "../src/index.ts";

describe("SignalEvent", () => {
  test("should call the listeners connected when the emit started", () => {
    const signal = new SignalEvent<[string]>();
    const calls: string[] = [];
    function late(value: string) {
      calls.push(`late:${value}`);
    }
    const first = signal.connect((value) => {
      calls.push(`first:${value}`);
      first.disconnect();
      signal.connect(late);
    });
    signal.connect((value) => calls.push(`second:${value}`));

    signal.emit("a");
    signal.emit("b");

    assert.deepStrictEqual(
      calls,
      ["first:a", "second:a", "second:b", "late:b"]
    );
  });

  test("should stop calling a listener once its connection is disconnected", () => {
    const signal = new SignalEvent<[number]>();
    const calls: number[] = [];
    const connection = signal.connect((value) => calls.push(value));

    signal.emit(1);
    connection.disconnect();
    signal.emit(2);

    assert.deepStrictEqual(calls, [1]);
  });

  test("should call a once listener on the first emit only", () => {
    const signal = new SignalEvent<[number]>();
    const calls: number[] = [];
    signal.connect((value) => calls.push(value), { once: true });

    signal.emit(1);
    signal.emit(2);

    assert.deepStrictEqual(calls, [1]);
  });

  test("should resolve next() with the arguments of the following emit", async() => {
    const signal = new SignalEvent<[amount: number, source: string]>();
    const next = signal.next();

    signal.emit(10, "fireball");
    signal.emit(20, "arrow");

    assert.deepStrictEqual(await next, [10, "fireball"]);
  });
});
