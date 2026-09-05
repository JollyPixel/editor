// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GamepadVibration } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";

describe("Controls.GamepadVibration", () => {
  let actuator: ReturnType<typeof mocks.GamepadHapticActuator>;
  let vibration: GamepadVibration;

  beforeEach(() => {
    actuator = mocks.GamepadHapticActuator();
    vibration = new GamepadVibration(actuator);
  });

  test("should report canVibrate as false without an actuator", () => {
    const noActuator = new GamepadVibration();

    assert.strictEqual(noActuator.canVibrate, false);
  });

  test("should report canVibrate as true with an actuator", () => {
    assert.strictEqual(vibration.canVibrate, true);
  });

  test("should resolve false when pulsing without an actuator", async() => {
    const noActuator = new GamepadVibration();

    const result = await noActuator.pulse(1, 200);
    assert.strictEqual(result, false);
  });

  test("should resolve false when stopping without an actuator", async() => {
    const noActuator = new GamepadVibration();

    const result = await noActuator.stop();
    assert.strictEqual(result, false);
  });

  test("should play a dual-rumble effect with default magnitudes", async() => {
    const result = await vibration.pulse(0.6, 250);

    assert.strictEqual(result, true);
    assert.strictEqual(actuator.playEffect.mock.callCount(), 1);
    const [effectType, params] = actuator.playEffect.mock.calls[0].arguments;
    assert.strictEqual(effectType, "dual-rumble");
    assert.deepEqual(params, {
      duration: 250,
      startDelay: 0,
      strongMagnitude: 0.6,
      weakMagnitude: 0.6
    });
  });

  test("should forward custom options to playEffect", async() => {
    await vibration.pulse(0.6, 250, {
      startDelay: 50,
      strongMagnitude: 1,
      weakMagnitude: 0.2,
      effectType: "trigger-rumble"
    });

    const [effectType, params] = actuator.playEffect.mock.calls[0].arguments;
    assert.strictEqual(effectType, "trigger-rumble");
    assert.deepEqual(params, {
      duration: 250,
      startDelay: 50,
      strongMagnitude: 1,
      weakMagnitude: 0.2
    });
  });

  test("should resolve false when the effect is preempted", async() => {
    actuator.playEffect.mock.mockImplementationOnce(
      () => Promise.resolve("preempted")
    );

    const result = await vibration.pulse(1, 200);
    assert.strictEqual(result, false);
  });

  test("should call reset on stop", async() => {
    const result = await vibration.stop();

    assert.strictEqual(result, true);
    assert.strictEqual(actuator.reset.mock.callCount(), 1);
  });

  test("should update the wrapped actuator via the actuator setter", async() => {
    const noActuator = new GamepadVibration();
    noActuator.actuator = actuator;

    assert.strictEqual(noActuator.canVibrate, true);
    assert.strictEqual(await noActuator.pulse(1, 100), true);
  });
});
