// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  Axis,
  AxisMap
} from "../../src/index.ts";

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

declare const target: Vector3;

const map = new AxisMap({
  moveX: Axis.buttons("KeyD", "KeyA"),
  moveY: Axis.buttons("KeyW", "KeyS")
});

test("axis names are inferred from the definition", () => {
  expect(map).type.toBe<AxisMap<"moveX" | "moveY">>();
  expect(map.names).type.toBe<Iterable<"moveX" | "moveY">>();
});

test("only declared axis names can be read", () => {
  expect(map.value).type.toBeCallableWith("moveX");
  expect(map.value).type.not.toBeCallableWith("jump");
  expect(map.vector2).type.not.toBeCallableWith("moveX", "jump", target);
});

test("vector writers return the target type", () => {
  expect(map.vector2("moveX", "moveY", target)).type.toBe<Vector3>();
  expect(map.vector3("moveX", "moveY", "moveX", target)).type.toBe<Vector3>();
  expect(map.vector2).type.not.toBeCallableWith("moveX", "moveY", { x: 0 });
});

test("definition values must be axes", () => {
  expect(AxisMap).type.not.toBeConstructableWith({ moveX: "KeyD" });
});

test("an explicit string map accepts any name", () => {
  const loose = new AxisMap<string>({});

  expect(loose.value).type.toBeCallableWith("anything");
});
