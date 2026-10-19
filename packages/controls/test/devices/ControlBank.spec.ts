// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ControlBank } from "../../src/devices/ControlBank.ts";

describe("Controls.ControlBank", () => {
  test("a press is down at once and pressed only after a publish", () => {
    const bank = new ControlBank<string>();

    bank.press("a");
    assert.equal(bank.isDown("a"), true);
    assert.equal(bank.wasPressed("a"), false);

    bank.sample();
    bank.publish("step");
    assert.equal(bank.wasPressed("a"), true);

    bank.sample();
    bank.publish("step");
    assert.equal(bank.wasPressed("a"), false);
    assert.equal(bank.isDown("a"), true);
  });

  test("a tap between two samples reports both edges", () => {
    const bank = new ControlBank<string>();

    bank.press("a");
    bank.release("a");
    bank.sample();
    bank.publish("step");

    assert.equal(bank.wasPressed("a"), true);
    assert.equal(bank.wasReleased("a"), true);
    assert.equal(bank.isDown("a"), false);
  });

  test("each reader takes an edge once, on its own schedule", () => {
    const bank = new ControlBank<string>();
    bank.press("a");
    bank.sample();

    bank.publish("step");
    assert.equal(bank.wasPressed("a"), true);
    bank.publish("step");
    assert.equal(bank.wasPressed("a"), false);

    bank.publish("frame");
    assert.equal(bank.wasPressed("a"), true);
    bank.publish("frame");
    assert.equal(bank.wasPressed("a"), false);
  });

  test("edges stay pending for a reader across samples it skips", () => {
    const bank = new ControlBank<string>();
    bank.press("a");
    bank.sample();
    bank.publish("frame");
    bank.release("a");
    bank.sample();
    bank.publish("frame");

    bank.publish("step");

    assert.equal(bank.wasPressed("a"), true);
    assert.equal(bank.wasReleased("a"), true);
  });

  test("a repeat is an edge of its own and leaves the press alone", () => {
    const bank = new ControlBank<string>();
    bank.press("a");
    bank.sample();
    bank.publish("step");

    bank.press("a");
    bank.repeat("a");
    bank.sample();
    bank.publish("step");

    assert.equal(bank.wasRepeated("a"), true);
    assert.equal(bank.wasPressed("a"), false);
  });

  test("the state before a window follows the first edge across samples", () => {
    const bank = new ControlBank<string>();
    bank.press("held");
    bank.sample();
    bank.publish("step");

    bank.release("held");
    bank.press("tapped");
    bank.sample();
    bank.press("held");
    bank.release("tapped");
    bank.press("tapped");
    bank.sample();
    bank.publish("step");

    assert.deepStrictEqual(
      {
        held: bank.wasDownBefore("held"),
        tapped: bank.wasDownBefore("tapped"),
        idle: bank.wasDownBefore("idle")
      },
      {
        held: true,
        tapped: false,
        idle: false
      }
    );
  });

  test("ANY and NONE match the held controls and each edge", () => {
    const bank = new ControlBank<string>();
    assert.equal(bank.isDown("NONE"), true);
    assert.equal(bank.isDown("ANY"), false);

    bank.press("a");
    bank.sample();
    bank.publish("step");

    assert.equal(bank.isDown("ANY"), true);
    assert.equal(bank.wasPressed("ANY"), true);
    assert.equal(bank.wasReleased("NONE"), true);
  });

  test("releaseAll() releases every held control with an edge", () => {
    const bank = new ControlBank<string>();
    bank.press("a");
    bank.press("b");
    bank.sample();
    bank.publish("step");

    bank.releaseAll();
    bank.sample();
    bank.publish("step");

    assert.equal(bank.isDown("ANY"), false);
    assert.equal(bank.wasReleased("a"), true);
    assert.equal(bank.wasReleased("b"), true);
  });

  test("active follows the latest sample", () => {
    const bank = new ControlBank<string>();
    bank.press("a");
    bank.release("a");
    bank.sample();
    assert.equal(bank.active, true);

    bank.sample();
    assert.equal(bank.active, false);

    bank.press("a");
    bank.sample();
    bank.sample();
    assert.equal(bank.active, true);
  });

  test("reset() drops held controls and pending edges", () => {
    const bank = new ControlBank<string>();
    bank.press("a");
    bank.sample();

    bank.reset();
    bank.publish("step");

    assert.equal(bank.isDown("a"), false);
    assert.equal(bank.wasPressed("a"), false);
    assert.equal(bank.active, false);
  });
});
