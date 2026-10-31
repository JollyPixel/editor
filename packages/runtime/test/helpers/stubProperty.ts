// Import Node.js Dependencies
import {
  after,
  before
} from "node:test";

export function stubProperty(
  target: object,
  name: PropertyKey,
  value: unknown
): void {
  let original: PropertyDescriptor | undefined;

  before(() => {
    original = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, {
      configurable: true,
      value
    });
  });
  after(() => {
    if (original === undefined) {
      Reflect.deleteProperty(target, name);
    }
    else {
      Object.defineProperty(target, name, original);
    }
  });
}
