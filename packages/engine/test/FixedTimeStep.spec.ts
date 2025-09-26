/* eslint-disable no-empty-function */
// Import Node.js Dependencies
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { FixedTimeStep, type FixedTimeStepClock } from "../src/systems/FixedTimeStep.js";

// CONSTANTS
const kDefaultFps = 60;
// ~16.67ms
const kUpdateInterval = 1000 / kDefaultFps;
const kFloatTolerance = 0.001;

describe("FixedTimeStep", () => {
  let fixedTimeStep: FixedTimeStep;
  let mockClock: FixedTimeStepClock;

  beforeEach(() => {
    mockClock = {
      update: () => {},
      getDelta: () => kUpdateInterval
    };
    fixedTimeStep = new FixedTimeStep(mockClock);
  });

  test("should initialize with default values", () => {
    const timeStep = new FixedTimeStep();
    assert.strictEqual(timeStep.framesPerSecond, kDefaultFps);
    assert.ok(timeStep.clock);
  });

  test("should initialize with custom clock", () => {
    const customClock = {
      update: () => {},
      getDelta: () => 10
    };
    const timeStep = new FixedTimeStep(customClock);
    assert.strictEqual(timeStep.clock, customClock);
  });

  test("should return zero updates when accumulated time is less than update interval", () => {
    // Less than ~16.67ms
    const accumulatedTime = 10;
    const result = fixedTimeStep.tick(accumulatedTime);

    assert.strictEqual(result.updates, 0);
    assert.strictEqual(result.timeLeft, accumulatedTime);
  });

  test("should return one update when accumulated time equals update interval", () => {
    const accumulatedTime = kUpdateInterval;
    const result = fixedTimeStep.tick(accumulatedTime);

    assert.strictEqual(result.updates, 1);
    assert.strictEqual(result.timeLeft, 0);
  });

  test("should return multiple updates for large accumulated time", () => {
    const accumulatedTime = kUpdateInterval * 3.5;
    const result = fixedTimeStep.tick(accumulatedTime);
    const expectedTimeLeft = kUpdateInterval * 0.5;

    assert.strictEqual(result.updates, 3);
    assert.ok(Math.abs(result.timeLeft - expectedTimeLeft) < kFloatTolerance);
  });

  test.skip("should limit updates to prevent doom spiral", () => {
    const maxUpdates = 5;
    // Way too much time
    const accumulatedTime = kUpdateInterval * 20;
    const result = fixedTimeStep.tick(accumulatedTime);

    assert.strictEqual(result.updates, maxUpdates - 1);
    assert.strictEqual(result.timeLeft, 0);
  });

  test("should call callback for each update", () => {
    const accumulatedTime = kUpdateInterval * 4;
    let callbackCount = 0;
    function callback() {
      callbackCount++;

      return false;
    }

    const result = fixedTimeStep.tick(accumulatedTime, callback);

    assert.strictEqual(result.updates, 3);
    assert.strictEqual(callbackCount, 3);
  });

  test.skip("should stop processing when callback returns true", () => {
    const accumulatedTime = kUpdateInterval * 4;
    let callbackCount = 0;
    function callback() {
      callbackCount++;

      return callbackCount === 2;
    }

    const result = fixedTimeStep.tick(accumulatedTime, callback);

    assert.strictEqual(result.updates, 2);
    assert.strictEqual(callbackCount, 2);
    assert.strictEqual(result.timeLeft, kUpdateInterval);
  });

  test("should work with custom frames per second", () => {
    const customFps = 30;
    const customUpdateInterval = 1000 / customFps;
    fixedTimeStep.framesPerSecond = customFps;

    const accumulatedTime = customUpdateInterval * 2.5;
    const result = fixedTimeStep.tick(accumulatedTime);
    const expectedTimeLeft = customUpdateInterval * 0.5;

    assert.strictEqual(result.updates, 2);
    assert.ok(Math.abs(result.timeLeft - expectedTimeLeft) < kFloatTolerance);
  });

  test("should call clock.update() on each tick", () => {
    let updateCalled = false;
    const spyClock = {
      update: () => {
        updateCalled = true;
      },
      getDelta: () => kUpdateInterval
    };
    const timeStep = new FixedTimeStep(spyClock);

    timeStep.tick(0);

    assert.strictEqual(updateCalled, true);
  });

  test("should handle zero accumulated time", () => {
    const result = fixedTimeStep.tick(0);

    assert.strictEqual(result.updates, 0);
    assert.strictEqual(result.timeLeft, 0);
  });

  test("should handle negative accumulated time", () => {
    const result = fixedTimeStep.tick(-100);

    assert.strictEqual(result.updates, 0);
    assert.strictEqual(result.timeLeft, -100);
  });

  test("should work with THREE.Timer integration", () => {
    const threeTimer = new THREE.Timer();
    const timeStep = new FixedTimeStep(threeTimer);

    // Simulate some time passing
    const accumulatedTime = kUpdateInterval * 2;
    const result = timeStep.tick(accumulatedTime);

    assert.strictEqual(result.updates, 2);
    assert.strictEqual(result.timeLeft, 0);
  });
});
