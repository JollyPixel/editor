// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  Mouse,
  MouseButtonState,
  MouseLockState
} from "../../../src/index.ts";

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

declare const mouse: Mouse;
declare const target: Vector3;

test("button queries accept names, indexes and sentinels", () => {
  expect(mouse.isDown).type.toBeCallableWith("left");
  expect(mouse.wasJustPressed).type.toBeCallableWith(3);
  expect(mouse.wasJustReleased).type.toBeCallableWith("ANY");
  expect(mouse.isDown).type.not.toBeCallableWith("KeyA");
});

test("buttonState() has no sentinel form", () => {
  expect(mouse.buttonState("right")).type.toBe<Readonly<MouseButtonState>>();
  expect(mouse.buttonState).type.not.toBeCallableWith("ANY");
});

test("vector writers return the target type", () => {
  expect(mouse.positionTo(target)).type.toBe<Vector3>();
  expect(mouse.deltaTo(target)).type.toBe<Vector3>();
  expect(mouse.scrollTo(target)).type.toBe<Vector3>();
  expect(mouse.positionTo).type.not.toBeCallableWith({ x: 0 });
});

test("events carry typed payloads", () => {
  mouse.on("lockStateChange", (state) => {
    expect(state).type.toBe<MouseLockState>();
  });
  mouse.on("down", (event) => {
    expect(event).type.toBe<MouseEvent>();
  });

  expect(mouse.on).type.not.toBeCallableWith("click", () => void 0);
});
